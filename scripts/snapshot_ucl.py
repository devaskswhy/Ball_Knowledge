"""Snapshot the Champions League into a committed JSON file.

The 2024/25 Champions League is finished, so its data will never change again.
Fetch it once, commit the file, and every later run reads from disk — the
deployed app makes zero API calls for this competition.

    python scripts/snapshot_ucl.py

Season 2024 is the newest the Free API-Football plan serves (it allows
2022-2024), which is also the first season of the 36-team league phase.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / "services" / ".env")

API_KEY = os.getenv("API_SPORTS_KEY") or os.getenv("API_FOOTBALL_KEY")
BASE_URL = "https://v3.football.api-sports.io"

LEAGUE_ID = 2
SEASON = 2024
OUT_PATH = REPO_ROOT / "data" / f"ucl_{SEASON}.json"


def api_get(client, path, params):
    r = client.get(f"{BASE_URL}{path}", headers={"x-apisports-key": API_KEY}, params=params)
    payload = r.json()
    if payload.get("errors"):
        raise SystemExit(f"API error on {path}: {payload['errors']}")
    return payload.get("response", [])


def main():
    if not API_KEY:
        raise SystemExit("API_SPORTS_KEY or API_FOOTBALL_KEY is not set.")

    requests_used = 0
    with httpx.Client(timeout=30) as client:
        print(f"Fetching Champions League {SEASON}/{str(SEASON + 1)[2:]}...")

        standings_raw = api_get(client, "/standings", {"league": LEAGUE_ID, "season": SEASON})
        requests_used += 1
        if not standings_raw:
            raise SystemExit("No standings returned.")

        league = standings_raw[0]["league"]
        groups = league.get("standings") or []
        rows = [row for group in groups for row in group]
        print(f"  standings: {len(rows)} clubs")

        fixtures_raw = api_get(client, "/fixtures", {"league": LEAGUE_ID, "season": SEASON})
        requests_used += 1
        print(f"  fixtures:  {len(fixtures_raw)} matches")

    table = [
        {
            "rank": row["rank"],
            "team_id": row["team"]["id"],
            "team": row["team"]["name"],
            "logo": row["team"]["logo"],
            "played": row["all"]["played"],
            "won": row["all"]["win"],
            "drawn": row["all"]["draw"],
            "lost": row["all"]["lose"],
            "goals_for": row["all"]["goals"]["for"],
            "goals_against": row["all"]["goals"]["against"],
            "goal_difference": row["goalsDiff"],
            "points": row["points"],
            "form": list(row.get("form") or ""),
        }
        for row in rows
    ]

    fixtures = [
        {
            "id": m["fixture"]["id"],
            "date": m["fixture"]["date"],
            "round": m["league"]["round"],
            "status": m["fixture"]["status"]["short"],
            "home_id": m["teams"]["home"]["id"],
            "home": m["teams"]["home"]["name"],
            "away_id": m["teams"]["away"]["id"],
            "away": m["teams"]["away"]["name"],
            "home_goals": m["goals"]["home"],
            "away_goals": m["goals"]["away"],
        }
        for m in fixtures_raw
    ]

    rounds = {}
    for f in fixtures:
        rounds[f["round"]] = rounds.get(f["round"], 0) + 1

    snapshot = {
        "competition": "UCL",
        "name": league.get("name", "UEFA Champions League"),
        "logo": league.get("logo"),
        "country": "Europe",
        "season": f"{SEASON}/{str(SEASON + 1)[2:]}",
        "api_season": SEASON,
        "complete": True,
        "snapshot_taken": datetime.now(timezone.utc).isoformat(),
        "requests_used": requests_used,
        "table": table,
        "fixtures": fixtures,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(snapshot, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"\nWrote {OUT_PATH}  ({OUT_PATH.stat().st_size // 1024} KB)")
    print(f"API requests used: {requests_used}")
    print("\nRounds captured:")
    for name, count in sorted(rounds.items(), key=lambda kv: -kv[1]):
        print(f"  {count:>3}  {name}")
    print("\nTop 8 of the league phase:")
    for row in table[:8]:
        print(f"  {row['rank']:>2} {row['team']:<24} {row['points']:>2}pts  "
              f"{row['goal_difference']:>+3}gd  {''.join(row['form'])}")


if __name__ == "__main__":
    main()
