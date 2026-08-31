"""Monte Carlo season simulation.

Plays out every fixture a league has left, ten thousand times, and counts how
often each club finishes in each position. Costs zero API calls — the current
table comes from played results and the match probabilities come from the Elo
and power model already in models/predictor.py.
"""

import numpy as np

from services.cache import cache
from services.standings import (
    COMPETITIONS,
    RELEGATION_SPOTS,
    build_standings,
    season_label,
    total_fixtures,
)

N_SIMULATIONS = 10_000
SEED = 20260831
CACHE_TTL_SECONDS = 3600

# Current goal difference, scaled well below one point, stands in for simulated
# goal difference when separating clubs level on points. It cannot overturn a
# points gap; it only orders ties.
GD_TIEBREAK_WEIGHT = 1e-3
JITTER_WEIGHT = 1e-5


def remaining_fixtures(df, teams):
    """Every ordered (home, away) pair of a double round robin not yet played."""
    played = set(zip(df["home"], df["away"]))
    return [
        (home, away)
        for home in teams
        for away in teams
        if home != away and (home, away) not in played
    ]


def _fixture_probabilities(predictor, fixtures):
    """(F, 3) matrix of home-win / draw / away-win probabilities, rows summing to 1."""
    probs = np.empty((len(fixtures), 3), dtype=np.float32)
    for i, (home, away) in enumerate(fixtures):
        res = predictor.predict_match(home, away)
        probs[i] = (res["home_win"], res["draw"], res["away_win"])

    return probs / probs.sum(axis=1, keepdims=True)


def simulate_season(ctx, code, n_sims=N_SIMULATIONS, seed=SEED):
    """Simulate the rest of a league season and return per-team outcomes."""
    df = ctx["df"]
    predictor = ctx["predictor"]
    table = ctx.get("standings")
    if table is None:
        table = build_standings(df)

    teams = list(table["team"])
    n_teams = len(teams)
    team_index = {team: i for i, team in enumerate(teams)}

    current_points = table["points"].to_numpy(dtype=np.float32)
    current_gd = table["goal_difference"].to_numpy(dtype=np.float32)

    fixtures = remaining_fixtures(df, teams)
    n_fixtures = len(fixtures)

    rng = np.random.default_rng(seed)

    if n_fixtures:
        probs = _fixture_probabilities(predictor, fixtures)

        # Sample every fixture of every season in one pass. Comparing a uniform
        # draw against the cumulative probabilities gives 0=home, 1=draw, 2=away.
        thresholds = np.cumsum(probs, axis=1)[:, :2]
        draws = rng.random((n_sims, n_fixtures), dtype=np.float32)
        outcomes = (draws[:, :, None] >= thresholds[None, :, :]).sum(axis=2)

        home_points = np.where(outcomes == 0, 3.0, np.where(outcomes == 1, 1.0, 0.0)).astype(np.float32)
        away_points = np.where(outcomes == 2, 3.0, np.where(outcomes == 1, 1.0, 0.0)).astype(np.float32)

        # Scatter fixture points onto teams with two dense one-hot matmuls,
        # which BLAS does far faster than an indexed accumulate.
        home_onehot = np.zeros((n_fixtures, n_teams), dtype=np.float32)
        away_onehot = np.zeros((n_fixtures, n_teams), dtype=np.float32)
        home_onehot[np.arange(n_fixtures), [team_index[h] for h, _ in fixtures]] = 1.0
        away_onehot[np.arange(n_fixtures), [team_index[a] for _, a in fixtures]] = 1.0

        final_points = current_points[None, :] + home_points @ home_onehot + away_points @ away_onehot
    else:
        # Season already complete — every simulation is the current table.
        final_points = np.repeat(current_points[None, :], n_sims, axis=0)

    # Rank each simulated season. Ties on points fall to current goal
    # difference, then to a per-simulation jitter so no club is favoured by
    # its alphabetical position.
    ranking_key = (
        final_points
        + current_gd[None, :] * GD_TIEBREAK_WEIGHT
        + rng.random((n_sims, n_teams), dtype=np.float32) * JITTER_WEIGHT
    )
    order = np.argsort(-ranking_key, axis=1)
    positions = np.empty_like(order)
    np.put_along_axis(
        positions, order, np.broadcast_to(np.arange(1, n_teams + 1), (n_sims, n_teams)), axis=1
    )

    relegation_spots = RELEGATION_SPOTS.get(code, 3)
    relegation_cutoff = n_teams - relegation_spots

    results = []
    for i, team in enumerate(teams):
        team_positions = positions[:, i]
        row = table.iloc[i]
        results.append({
            "team": team,
            "current_position": int(row["position"]),
            "current_points": int(row["points"]),
            "played": int(row["played"]),
            "projected_points": round(float(final_points[:, i].mean()), 1),
            "title_probability": round(float((team_positions == 1).mean()), 4),
            "top_4_probability": round(float((team_positions <= 4).mean()), 4),
            "relegation_probability": round(float((team_positions > relegation_cutoff).mean()), 4),
        })

    results.sort(key=lambda r: (-r["title_probability"], -r["projected_points"]))

    return {
        "competition": code,
        "league": COMPETITIONS[code]["name"],
        "season": season_label(df),
        "as_of": df["date"].max().date().isoformat(),
        "matches_played": int(len(df)),
        "total_matches": total_fixtures(n_teams),
        "fixtures_remaining": n_fixtures,
        "simulations": n_sims,
        "relegation_spots": relegation_spots,
        "teams": results,
    }


def title_race(ctx, code):
    """Cached title race for one league, computed on first request."""
    cache_key = f"title_race:{code}:{N_SIMULATIONS}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    result = simulate_season(ctx, code)
    cache.set(cache_key, result, CACHE_TTL_SECONDS)
    return result
