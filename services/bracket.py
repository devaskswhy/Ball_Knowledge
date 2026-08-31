"""Knockout bracket simulation for the Champions League.

Given only the league-phase table, replay the knockout rounds ten thousand
times and count how far each club gets.

Two-legged ties need no inner simulation. The aggregate score over both legs is
the sum of two independent Poisson draws, and the sum of independent Poissons
is itself Poisson, so P(A advances) has a closed form: P(X > Y) + half of
P(X = Y), for X and Y over each side's two-leg expected goals. That reduces the
whole bracket to sampling from a precomputed 36x36 matrix.
"""

import numpy as np

from services.cache import cache
from services.ucl import DIRECT_TO_R16, PLAYOFF_LAST_RANK

N_SIMULATIONS = 10_000
SEED = 20260831
CACHE_TTL_SECONDS = 3600
MAX_GOALS = 12

# Play-off pairings by league-phase rank. The two weakest qualifiers meet, and
# their winner faces the top seed, so the bracket rewards the league phase.
PLAYOFF_PAIRS = [(16, 17), (15, 18), (14, 19), (13, 20), (12, 21), (11, 22), (10, 23), (9, 24)]

# Fixed bracket tree: seed i+1 enters tie i, so ranks 1 and 2 can only meet in
# the final.
QF_TREE = [(0, 7), (1, 6), (2, 5), (3, 4)]
SF_TREE = [(0, 3), (1, 2)]

STAGES = ["r16", "qf", "sf", "final", "winner"]


def _poisson_pmf(lam, k_max=MAX_GOALS):
    k = np.arange(k_max + 1)
    log_factorial = np.cumsum(np.concatenate(([0.0], np.log(np.arange(1, k_max + 1)))))
    return np.exp(-lam + k * np.log(max(lam, 1e-9)) - log_factorial)


def _win_probability(lam_a, lam_b):
    """P(A wins), splitting a level score evenly — extra time and penalties."""
    pa, pb = _poisson_pmf(lam_a), _poisson_pmf(lam_b)
    joint = np.outer(pa, pb)
    joint /= joint.sum()
    return float(np.tril(joint, -1).sum() + np.trace(joint) * 0.5)


def build_tie_matrix(teams, goal_model, two_legged=True):
    """P(row team beats column team), over two legs or one neutral match."""
    n = len(teams)
    probs = np.full((n, n), 0.5)

    for i, home in enumerate(teams):
        for j, away in enumerate(teams):
            if i == j:
                continue
            # Leg one at i, leg two at j. Over the two legs each side plays one
            # home and one away, so the aggregate carries no home advantage.
            lam_i_home, lam_j_away = goal_model.expected_goals(home, away)
            lam_j_home, lam_i_away = goal_model.expected_goals(away, home)

            if two_legged:
                probs[i, j] = _win_probability(lam_i_home + lam_i_away, lam_j_home + lam_j_away)
            else:
                # One match on neutral ground: average each side's home and
                # away expectation instead of granting either the advantage.
                probs[i, j] = _win_probability(
                    (lam_i_home + lam_i_away) / 2, (lam_j_home + lam_j_away) / 2
                )

    return probs


def _play(rng, left, right, matrix):
    """Resolve one round. left/right are (n_sims,) arrays of team indices."""
    p = matrix[left, right]
    left_wins = rng.random(len(left)) < p
    return np.where(left_wins, left, right)


def simulate_bracket(ctx, n_sims=N_SIMULATIONS, seed=SEED):
    snapshot = ctx["snapshot"]
    goal_model = ctx["goal_model"]

    table = sorted(snapshot["table"], key=lambda r: r["rank"])
    teams = [r["team"] for r in table]
    index = {team: i for i, team in enumerate(teams)}

    # Only clubs the model has ratings for can be simulated.
    known = set(ctx["power_lookup"])
    missing = [t for t in teams if t not in known]
    if missing:
        print(f"[UCL] no rating for: {missing}")

    two_leg = build_tie_matrix(teams, goal_model, two_legged=True)
    one_leg = build_tie_matrix(teams, goal_model, two_legged=False)

    rng = np.random.default_rng(seed)

    def by_rank(rank):
        return np.full(n_sims, index[table[rank - 1]["team"]])

    # Play-off round: ranks 9-24, two legs.
    playoff_winners = [
        _play(rng, by_rank(hi), by_rank(lo), two_leg) for hi, lo in PLAYOFF_PAIRS
    ]

    # Round of 16: seed i+1 against the winner of play-off tie i.
    r16_winners = [
        _play(rng, by_rank(i + 1), playoff_winners[i], two_leg)
        for i in range(DIRECT_TO_R16)
    ]

    qf_winners = [_play(rng, r16_winners[a], r16_winners[b], two_leg) for a, b in QF_TREE]
    sf_winners = [_play(rng, qf_winners[a], qf_winners[b], two_leg) for a, b in SF_TREE]
    champion = _play(rng, sf_winners[0], sf_winners[1], one_leg)

    # Count how often each club reached each stage.
    n_teams = len(teams)

    def tally(entries):
        counts = np.zeros(n_teams)
        for arr in entries:
            counts += np.bincount(arr, minlength=n_teams)
        return counts / n_sims

    reach_r16 = np.zeros(n_teams)
    reach_r16[[index[table[r - 1]["team"]] for r in range(1, DIRECT_TO_R16 + 1)]] = 1.0
    reach_r16 += tally(playoff_winners)

    results = {
        "r16": reach_r16,
        "qf": tally(r16_winners),
        "sf": tally(qf_winners),
        "final": tally(sf_winners),
        "winner": tally([champion]),
    }

    actual = ctx.get("knockout", {})
    reached = actual.get("reached", {})

    rows = []
    for rank, row in enumerate(table, start=1):
        i = index[row["team"]]
        eliminated = rank > PLAYOFF_LAST_RANK
        rows.append({
            "seed": rank,
            "team": row["team"],
            "logo": row.get("logo"),
            "league_phase_points": row["points"],
            "goal_difference": row["goal_difference"],
            "entry": "round of 16" if rank <= DIRECT_TO_R16
                     else ("play-off" if not eliminated else "eliminated"),
            "reach_r16": round(float(results["r16"][i]), 4),
            "reach_qf": round(float(results["qf"][i]), 4),
            "reach_sf": round(float(results["sf"][i]), 4),
            "reach_final": round(float(results["final"][i]), 4),
            "win_probability": round(float(results["winner"][i]), 4),
            "actual_stage_reached": reached.get(row["team"]),
        })

    rows.sort(key=lambda r: -r["win_probability"])

    return {
        "competition": "UCL",
        "name": snapshot["name"],
        "season": snapshot["season"],
        "format": "36-club league phase, top 8 to the round of 16, 9-24 into a two-legged play-off",
        "simulations": n_sims,
        "actual_winner": actual.get("winner"),
        "teams": rows,
    }


def bracket(ctx, code="UCL"):
    """Cached bracket projection, computed on first request."""
    cache_key = f"bracket:{code}:{N_SIMULATIONS}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    result = simulate_bracket(ctx)
    cache.set(cache_key, result, CACHE_TTL_SECONDS)
    return result
