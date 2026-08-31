"""Champions League, loaded from a committed snapshot.

Everything here reads data/ucl_2024.json. No API calls at runtime.

The important part is where the club ratings come from. The domestic Elo pools
are computed per league, each starting from the same 1500 baseline, so a
Bundesliga 1580 and a La Liga 1580 are not the same number — they were earned
against different opposition and were never compared. Simulating a European
knockout on those ratings produces a confident answer with nothing behind it.

So the Champions League gets its own ratings, computed only from the 144
league-phase matches. Those 36 clubs played each other, which is exactly the
cross-league evidence the domestic pools lack.
"""

import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SNAPSHOT_PATH = DATA_DIR / "ucl_2024.json"

LEAGUE_PHASE_PREFIX = "League Stage"

# 2024/25 format: 36 clubs, one league phase, top 8 straight to the round of
# 16, ranks 9-24 into a two-legged play-off, ranks 25-36 eliminated.
DIRECT_TO_R16 = 8
PLAYOFF_LAST_RANK = 24


def load_snapshot(path=SNAPSHOT_PATH):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def league_phase_frame(snapshot):
    """The 144 league-phase results, in the shape the model pipeline expects."""
    rows = [
        {
            "date": f["date"],
            "home": f["home"],
            "away": f["away"],
            "home_goals": f["home_goals"],
            "away_goals": f["away_goals"],
        }
        for f in snapshot["fixtures"]
        if f["round"].startswith(LEAGUE_PHASE_PREFIX)
        and f["home_goals"] is not None
        and f["away_goals"] is not None
    ]

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], format="ISO8601", utc=True).dt.tz_localize(None)
    return df.sort_values("date").reset_index(drop=True)


def knockout_results(snapshot):
    """Who actually went how far, for validating the simulation."""
    stages = {
        "Knockout Round Play-offs": "playoff",
        "Round of 16": "r16",
        "Quarter-finals": "qf",
        "Semi-finals": "sf",
        "Final": "final",
    }

    reached = {}
    order = ["playoff", "r16", "qf", "sf", "final"]
    for fixture in snapshot["fixtures"]:
        stage = stages.get(fixture["round"])
        if not stage:
            continue
        for team in (fixture["home"], fixture["away"]):
            if order.index(stage) > order.index(reached.get(team, "playoff")):
                reached[team] = stage
            reached.setdefault(team, stage)

    final = next((f for f in snapshot["fixtures"] if f["round"] == "Final"), None)
    winner = None
    if final and final["home_goals"] is not None:
        winner = final["home"] if final["home_goals"] > final["away_goals"] else final["away"]

    return {"reached": reached, "winner": winner}


def load_ucl(league_manager, path=SNAPSHOT_PATH):
    """Register the Champions League with the league manager."""
    snapshot = load_snapshot(path)
    if not snapshot:
        print(f"    [WARNING] UCL snapshot not found at {path}. Run scripts/snapshot_ucl.py")
        return False

    df = league_phase_frame(snapshot)
    if df.empty:
        print("    [ERROR] UCL snapshot has no completed league-phase matches.")
        return False

    league_manager.build_from_frames(
        "UCL",
        [df],
        extra={
            "snapshot": snapshot,
            "knockout": knockout_results(snapshot),
        },
    )
    return league_manager.get_league("UCL") is not None
