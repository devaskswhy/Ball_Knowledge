import pandas as pd
from pathlib import Path

from models.elo_engine import EloEngine
from models.poisson import GoalModel
from models.predictor import MatchPredictor
from services.standings import build_standings

# Column names in the two source formats we accept.
RENAME_MAPS = [
    {"Date": "date", "HomeTeam": "home", "AwayTeam": "away", "FTHG": "home_goals", "FTAG": "away_goals"},
    {"Date": "date", "Home Team": "home", "Away Team": "away", "Home Goals": "home_goals", "Away Goals": "away_goals"},
]

REQUIRED = ["date", "home", "away", "home_goals", "away_goals"]

# How far ratings fall back toward the baseline between seasons.
SEASON_REGRESSION = 1 / 3

# Clubs promoted into a league start below the baseline. A promoted side is
# usually among the weakest in the division, not an average member of it.
PROMOTION_ELO_PENALTY = 60

# Rolling form is shrunk toward the league average as if every club had this
# many prior matches at par. Without it, a promoted club that wins its opener
# 2-0 shows a perfect defensive record from a single game and outranks clubs
# with a season of evidence behind them.
FORM_PRIOR_MATCHES = 8


def read_matches(csv_path):
    """Load one season CSV into date/home/away/home_goals/away_goals."""
    path = Path(csv_path)
    if not path.exists():
        print(f"[!] CSV NOT FOUND: {csv_path} (Skipping)")
        return None

    try:
        df = pd.read_csv(path, encoding="latin1")
    except Exception as e:
        print(f"Error reading CSV {path}: {e}")
        return None

    for rename_map in RENAME_MAPS:
        if any(col in df.columns for col in rename_map):
            df = df.rename(columns=rename_map)
            break

    if not all(c in df.columns for c in REQUIRED):
        print(f"[!] Missing columns in {csv_path}. Found: {df.columns.tolist()}")
        return None

    try:
        df["date"] = pd.to_datetime(df["date"], dayfirst=True, format="mixed", errors="coerce")
    except ValueError:
        df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")

    df = df[REQUIRED].dropna(subset=REQUIRED)
    df = df.sort_values("date").reset_index(drop=True)

    if df.empty:
        print(f"[!] {csv_path} has no usable rows after parsing.")
        return None

    return df


class LeagueManager:
    def __init__(self):
        self.leagues = {}

    def load_league(self, league_code, csv_paths):
        """Load a league from one or more season CSVs, oldest first.

        Every season feeds Elo and form; only the newest is the current table.
        That way a season two rounds old still has real strength estimates
        behind it instead of every club sitting on the 1500 baseline.
        """
        if isinstance(csv_paths, (str, Path)):
            csv_paths = [csv_paths]

        seasons = [df for df in (read_matches(p) for p in csv_paths) if df is not None]
        if not seasons:
            print(f"[!] League {league_code}: no usable data.")
            return

        current = seasons[-1]
        history = pd.concat(seasons, ignore_index=True).sort_values("date").reset_index(drop=True)

        # 1. Elo across every season, regressed toward the mean at each boundary
        elo = EloEngine()
        for i, season_df in enumerate(seasons):
            if i:
                elo.regress_to_mean(SEASON_REGRESSION)
                season_teams = set(season_df["home"]).union(season_df["away"])
                for team in season_teams - set(elo.team_elos):
                    elo.team_elos[team] = elo.base_elo - PROMOTION_ELO_PENALTY
            elo.compute_season(season_df)

        elo_df = pd.DataFrame(
            [{"team": t, "elo": v} for t, v in elo.team_elos.items()],
            columns=["team", "elo"],
        )

        # 2. Form over the full history, then restricted to the clubs actually
        #    in this league now — last season's relegated sides are not.
        current_teams = set(current["home"]).union(current["away"])
        final_stats = self._compute_stats(history)
        final_stats = final_stats[final_stats["team"].isin(current_teams)].reset_index(drop=True)

        if final_stats.empty:
            print(f"[!] League {league_code}: could not compute stats.")
            return

        tf = final_stats.merge(elo_df, on="team", how="left")

        # 3. Power score, normalised across the clubs in this league now
        tf["defence_strength"] = -tf["ga_last10"]
        tf["attack_strength"] = tf["gf_last10"]
        tf["form_strength"] = tf["pts_last5"]
        tf["elo_strength"] = tf["elo"]

        for c in ["elo_strength", "attack_strength", "defence_strength", "form_strength"]:
            mn, mx = tf[c].min(), tf[c].max()
            tf[c + "_norm"] = 0.5 if mn == mx else (tf[c] - mn) / (mx - mn)

        tf["raw_power"] = (
            0.4 * tf["elo_strength_norm"]
            + 0.25 * tf["attack_strength_norm"]
            + 0.2 * tf["defence_strength_norm"]
            + 0.15 * tf["form_strength_norm"]
        )

        mn, mx = tf["raw_power"].min(), tf["raw_power"].max()
        tf["power_score"] = 50 if mn == mx else 100 * (tf["raw_power"] - mn) / (mx - mn)

        power_table = tf[
            ["team", "power_score", "elo", "gf_last10", "ga_last10", "pts_last5"]
        ].sort_values("power_score", ascending=False)
        power_lookup = dict(zip(power_table["team"], power_table["power_score"]))

        # 4. Goal model and predictor. The goal model calibrates its draw rate
        #    on the full history — a far larger sample than one part-played
        #    season, which matters most in August when the season is 2 rounds old.
        goal_model = GoalModel(history, final_stats)
        predictor = MatchPredictor(elo, power_lookup, goal_model)

        self.leagues[league_code] = {
            "predictor": predictor,
            "power_table": power_table,
            "power_lookup": power_lookup,
            "elo_df": elo_df,
            "final_stats": final_stats,
            "elo_engine": elo,
            "df": current,
            "history_df": history,
            "seasons": len(seasons),
            "standings": build_standings(current),
            "goal_model": goal_model,
        }
        print(
            f"[OK] League {league_code} loaded. {len(power_lookup)} teams, "
            f"{len(seasons)} season(s), {len(current)} current-season matches."
        )

    def _compute_stats(self, df):
        """Rolling form per team, shrunk toward the league average.

        Returns one row per team with pts_last5, gf_last10 and ga_last10, plus
        the number of matches those figures rest on.
        """
        home_df = df[["date", "home", "home_goals", "away_goals"]].rename(
            columns={"home": "team", "home_goals": "goals_for", "away_goals": "goals_against"}
        )
        away_df = df[["date", "away", "home_goals", "away_goals"]].rename(
            columns={"away": "team", "away_goals": "goals_for", "home_goals": "goals_against"}
        )
        team_matches = pd.concat([home_df, away_df], ignore_index=True)

        team_matches["points"] = (
            (team_matches["goals_for"] > team_matches["goals_against"]) * 3
            + (team_matches["goals_for"] == team_matches["goals_against"]) * 1
        )
        team_matches = team_matches.sort_values(["team", "date"]).reset_index(drop=True)

        g = team_matches.groupby("team")
        team_matches["pts_last5"] = g["points"].rolling(5, min_periods=1).mean().reset_index(level=0, drop=True)
        team_matches["gf_last10"] = g["goals_for"].rolling(10, min_periods=1).mean().reset_index(level=0, drop=True)
        team_matches["ga_last10"] = g["goals_against"].rolling(10, min_periods=1).mean().reset_index(level=0, drop=True)

        stats = (
            team_matches.sort_values("date")
            .groupby("team")
            .tail(1)[["team", "pts_last5", "gf_last10", "ga_last10"]]
            .reset_index(drop=True)
        )
        stats = stats.merge(
            team_matches.groupby("team").size().rename("matches").reset_index(), on="team", how="left"
        )

        # Shrink toward the league average, weighted by how much evidence each
        # club actually has. A club with 30 matches keeps ~79% of its own
        # figure; one with a single match keeps ~11%.
        league = {
            "pts_last5": float(team_matches["points"].mean()),
            "gf_last10": float(team_matches["goals_for"].mean()),
            "ga_last10": float(team_matches["goals_against"].mean()),
        }
        weight = stats["matches"].clip(upper=10)
        for column, league_mean in league.items():
            stats[column] = (
                weight * stats[column] + FORM_PRIOR_MATCHES * league_mean
            ) / (weight + FORM_PRIOR_MATCHES)

        return stats

    def get_league(self, code):
        return self.leagues.get(code)
