"""football-data.org client - current-season fixtures and top scorers.

This replaces API-Football for the homepage. Two reasons it is a better fit:
the free tier serves the *current* season (API-Football's free plan stopped at
2024, so its "top players" were two seasons stale), and it needs no billing
account.

Free tier is 10 requests/minute, so everything here is cached: fixtures for
30 minutes, scorers for 6 hours. A homepage load costs at most 6 requests
cold and 0 warm.
"""

import os

import httpx
from services.cache import cached
from services.env import load_env

load_env()

BASE_URL = "https://api.football-data.org/v4"


def _token():
    """Read the token at call time, not import time.

    Several modules call load_dotenv() and the one that runs first wins, so
    reading os.environ during import made this depend on import order - it
    resolved to None inside uvicorn while working fine on a direct import.
    """
    return os.getenv("FOOTBALL_DATA_TOKEN")

# Our competition codes -> football-data.org codes.
COMPETITION_CODES = {
    "PL": "PL",    # Premier League
    "LL": "PD",    # Primera Division
    "SA": "SA",    # Serie A
    "BL": "BL1",   # Bundesliga
    "L1": "FL1",   # Ligue 1
    "UCL": "CL",   # Champions League
}

# Scorers are only fetched for the domestic leagues - the Champions League
# has barely any goals scored this early and would spend a request for noise.
SCORER_COMPETITIONS = ["PL", "LL", "SA", "BL", "L1"]

FIXTURES_TTL = 1800      # 30 minutes
SCORERS_TTL = 21600      # 6 hours

# football-data.org's status vocabulary mapped to the short codes the UI
# already understands, so the live/upcoming badge keeps working unchanged.
STATUS_MAP = {
    "SCHEDULED": "NS",
    "TIMED": "NS",
    "IN_PLAY": "1H",
    "PAUSED": "HT",
    "FINISHED": "FT",
    "SUSPENDED": "SUSP",
    "POSTPONED": "PST",
    "CANCELLED": "CANC",
}


def is_configured():
    return bool(_token())


async def _get(client, path, params=None):
    """One GET against football-data.org. Returns None on any failure."""
    try:
        r = await client.get(
            f"{BASE_URL}{path}",
            headers={"X-Auth-Token": _token()},
            params=params or {},
            timeout=20,
        )
        if r.status_code != 200:
            print(f"[football-data] {path} -> HTTP {r.status_code}")
            return None
        payload = r.json()
        if "errorCode" in payload:
            print(f"[football-data] {path} -> {payload.get('message')}")
            return None
        return payload
    except Exception as e:
        print(f"[football-data] {path} failed: {e}")
        return None


@cached(ttl_seconds=FIXTURES_TTL, key_prefix="fd_fixtures")
async def get_fixtures():
    """Today's matches across every competition the token can see."""
    if not _token():
        print("[football-data] FOOTBALL_DATA_TOKEN is not set")
        return []

    async with httpx.AsyncClient() as client:
        payload = await _get(client, "/matches")

    if not payload:
        return []

    wanted = set(COMPETITION_CODES.values())
    fixtures = []
    for m in payload.get("matches", []):
        comp = m.get("competition", {})
        code = comp.get("code")
        home, away = m.get("homeTeam") or {}, m.get("awayTeam") or {}
        score = (m.get("score") or {}).get("fullTime") or {}

        fixtures.append({
            "id": m.get("id"),
            "date": m.get("utcDate"),
            "status": STATUS_MAP.get(m.get("status"), m.get("status")),
            "home": {
                "id": home.get("id"),
                "name": home.get("shortName") or home.get("name"),
                "logo": home.get("crest"),
            },
            "away": {
                "id": away.get("id"),
                "name": away.get("shortName") or away.get("name"),
                "logo": away.get("crest"),
            },
            "league": {"name": comp.get("name"), "logo": comp.get("emblem")},
            "score": {"home": score.get("home"), "away": score.get("away")},
            "in_covered_league": code in wanted,
        })

    # Matches in the competitions this app actually models come first.
    fixtures.sort(key=lambda f: (not f["in_covered_league"], f["date"] or ""))
    return fixtures


@cached(ttl_seconds=SCORERS_TTL, key_prefix="fd_scorers")
async def get_top_scorers(limit_per_competition=5):
    """Leading scorers across the big-5 leagues, current season."""
    if not _token():
        print("[football-data] FOOTBALL_DATA_TOKEN is not set")
        return {"players": [], "season": None}

    players = []
    season_label = None

    async with httpx.AsyncClient() as client:
        for code in SCORER_COMPETITIONS:
            fd_code = COMPETITION_CODES[code]
            payload = await _get(
                client,
                f"/competitions/{fd_code}/scorers",
                {"limit": limit_per_competition},
            )
            if not payload:
                continue

            season = payload.get("season") or {}
            if season_label is None and season.get("startDate"):
                start = season["startDate"][:4]
                season_label = f"{start}/{str(int(start) + 1)[2:]}"

            for s in payload.get("scorers", []):
                player = s.get("player") or {}
                team = s.get("team") or {}
                players.append({
                    "id": player.get("id"),
                    "name": player.get("name"),
                    "nationality": player.get("nationality"),
                    "team": team.get("shortName") or team.get("name"),
                    "team_crest": team.get("crest"),
                    "competition": code,
                    "goals": s.get("goals") or 0,
                    "assists": s.get("assists") or 0,
                    "penalties": s.get("penalties") or 0,
                })

    players.sort(key=lambda p: (-p["goals"], -p["assists"]))
    return {"players": players, "season": season_label}
