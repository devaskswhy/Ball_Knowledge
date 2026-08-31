"""League tables computed from match results.

Every figure here comes from matches that were actually played — the CSVs in
data/ are football-data.co.uk files for the current season. They are a PARTIAL
season, so every payload carries `as_of` and `matches_played`; the UI must show
those rather than implying the table is final.
"""

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Competition registry
# ---------------------------------------------------------------------------
# `kind` decides where standings come from:
#   "league" -> computed from a football-data.co.uk CSV (partial season)
#   "cup"    -> loaded from a committed JSON snapshot (complete season)
# Phase 3 adds the Champions League as a "cup" without touching the route.

COMPETITIONS = {
    "PL": {"name": "Premier League", "country": "England", "kind": "league", "teams": 20},
    "LL": {"name": "La Liga", "country": "Spain", "kind": "league", "teams": 20},
    "SA": {"name": "Serie A", "country": "Italy", "kind": "league", "teams": 20},
    "L1": {"name": "Ligue 1", "country": "France", "kind": "league", "teams": 18},
    "BL": {"name": "Bundesliga", "country": "Germany", "kind": "league", "teams": 18},
}

# Teams relegated from the bottom of each league.
RELEGATION_SPOTS = {"PL": 3, "LL": 3, "SA": 3, "L1": 2, "BL": 2}

FORM_LENGTH = 5


def _team_match_rows(df):
    """One row per team per match, from a fixture-per-row DataFrame."""
    home = df[["date", "home", "away", "home_goals", "away_goals"]].rename(
        columns={"home": "team", "away": "opponent", "home_goals": "gf", "away_goals": "ga"}
    )
    away = df[["date", "away", "home", "away_goals", "home_goals"]].rename(
        columns={"away": "team", "home": "opponent", "away_goals": "gf", "home_goals": "ga"}
    )
    rows = pd.concat([home, away], ignore_index=True)

    rows["result"] = np.select(
        [rows["gf"] > rows["ga"], rows["gf"] == rows["ga"]],
        ["W", "D"],
        default="L",
    )
    rows["points"] = rows["result"].map({"W": 3, "D": 1, "L": 0})
    return rows


def build_standings(df):
    """Build a league table from played matches.

    Returns a DataFrame ordered by points, then goal difference, then goals
    scored — the ordering used by all five of the leagues we cover.
    """
    rows = _team_match_rows(df)

    rows["won"] = (rows["result"] == "W").astype(int)
    rows["drawn"] = (rows["result"] == "D").astype(int)
    rows["lost"] = (rows["result"] == "L").astype(int)

    table = rows.groupby("team", as_index=False).agg(
        played=("result", "size"),
        won=("won", "sum"),
        drawn=("drawn", "sum"),
        lost=("lost", "sum"),
        goals_for=("gf", "sum"),
        goals_against=("ga", "sum"),
        points=("points", "sum"),
    )
    table["goal_difference"] = table["goals_for"] - table["goals_against"]

    # Form: last FORM_LENGTH results, most recent last.
    form = (
        rows.sort_values("date")
        .groupby("team")["result"]
        .apply(lambda s: list(s.tail(FORM_LENGTH)))
        .rename("form")
        .reset_index()
    )
    table = table.merge(form, on="team", how="left")

    table = table.sort_values(
        ["points", "goal_difference", "goals_for"], ascending=False
    ).reset_index(drop=True)
    table.insert(0, "position", np.arange(1, len(table) + 1))

    int_cols = [
        "position", "played", "won", "drawn", "lost",
        "goals_for", "goals_against", "goal_difference", "points",
    ]
    table[int_cols] = table[int_cols].astype(int)
    return table


def season_label(df):
    """'2025/26' from the earliest match in the data."""
    first = df["date"].min()
    start_year = first.year if first.month >= 7 else first.year - 1
    return f"{start_year}/{str(start_year + 1)[2:]}"


def total_fixtures(team_count):
    """Matches in a full double round robin."""
    return team_count * (team_count - 1)


# ---------------------------------------------------------------------------
# Standings sources
# ---------------------------------------------------------------------------

def _league_standings(code, ctx):
    """Standings for a CSV-backed league — a partial, in-progress season."""
    df = ctx["df"]
    table = ctx.get("standings")
    if table is None:
        table = build_standings(df)

    meta = COMPETITIONS[code]
    played = int(len(df))

    return {
        "competition": code,
        "league": meta["name"],
        "kind": "league",
        "season": season_label(df),
        "as_of": df["date"].max().date().isoformat(),
        "matches_played": played,
        "total_matches": total_fixtures(len(table)),
        "complete": played >= total_fixtures(len(table)),
        "table": table.to_dict(orient="records"),
    }


_SOURCES = {"league": _league_standings}


def get_standings_source(code):
    """Return the builder for a competition, or None if it is not registered.

    The returned callable takes the league context and produces the /standings
    payload. Adding a competition means adding a registry entry and, for a new
    kind, one function in _SOURCES — the route never changes.
    """
    meta = COMPETITIONS.get(code)
    if not meta:
        return None

    builder = _SOURCES.get(meta["kind"])
    if not builder:
        return None

    def source(ctx):
        return builder(code, ctx)

    return source
