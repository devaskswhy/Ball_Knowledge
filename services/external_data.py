import os
from datetime import date, datetime

import httpx

from services.cache import cached
from services.env import load_env

load_env()
API_KEY = os.getenv("API_SPORTS_KEY") or os.getenv("API_FOOTBALL_KEY")
if not API_KEY:
    raise RuntimeError("API_SPORTS_KEY or API_FOOTBALL_KEY is not set. Add it to your .env file.")

HEADERS = {
    "x-apisports-key": API_KEY
}
BASE_URL = "https://v3.football.api-sports.io"

# Shared async HTTP client with timeout
http_client = httpx.AsyncClient(timeout=10.0)

# ---------------- DAILY REQUEST BUDGET ----------------
# The API-Football key is a Free plan: 100 requests/day, seasons 2022-2024 only.
# Stop at 90 so a burst of traffic can never lock the account out entirely.
DAILY_REQUEST_LIMIT = 90

_budget = {"day": date.today(), "used": 0}


def _roll_day():
    today = date.today()
    if _budget["day"] != today:
        _budget["day"] = today
        _budget["used"] = 0


def request_budget():
    """Current daily API usage, for /health and debugging."""
    _roll_day()
    used = _budget["used"]
    return {
        "day": _budget["day"].isoformat(),
        "used": used,
        "limit": DAILY_REQUEST_LIMIT,
        "remaining": max(0, DAILY_REQUEST_LIMIT - used),
    }


async def api_get(path, params):
    """GET an API-Football endpoint, respecting the daily request budget.

    Returns the `response` list on success, or None when the request was not
    made (budget exhausted) or when it failed. Callers must treat None as
    "no data" and serve whatever they can without it.
    """
    _roll_day()

    used = _budget["used"]
    if used >= DAILY_REQUEST_LIMIT:
        print(
            "[api-football] daily budget exhausted "
            f"({used}/{DAILY_REQUEST_LIMIT} on {_budget['day']}) - skipping GET {path}"
        )
        return None

    _budget["used"] = used + 1
    print(f"[api-football] request {used + 1}/{DAILY_REQUEST_LIMIT} - GET {path} {params}")

    try:
        r = await http_client.get(f"{BASE_URL}{path}", headers=HEADERS, params=params)
        payload = r.json()
    except Exception as e:
        print(f"[api-football] error on {path}: {e}")
        return None

    errors = payload.get("errors")
    if errors:
        print(f"[api-football] API returned errors for {path}: {errors}")

    return payload.get("response", [])


POSITION_MAP = {
    "Goalkeeper": "GK",
    "Defender": "DEF",
    "Midfielder": "MID",
    "Attacker": "ATT",
}

# Top 5 league IDs: PL=39, La Liga=140, Serie A=135, Bundesliga=78, Ligue 1=61
TOP_LEAGUE_IDS = [39, 140, 135, 78, 61]


@cached(ttl_seconds=600, key_prefix="injuries")
async def get_injuries(team_id, season=2024):
    data = await api_get("/injuries", {"team": team_id, "season": season})
    if not data:
        return []

    injuries = []
    for i in data:
        fi = i["player"]
        position = POSITION_MAP.get(fi["type"], "MID")

        # Deduplicate by name
        if any(inj["name"] == fi["name"] for inj in injuries):
            continue

        injuries.append({
            "id": str(hash(fi["name"])),
            "name": fi["name"],
            "position": position,
            "impact": 5,  # Default impact, user adjusts manually
        })

    return injuries[:8]  # Limit to 8 to avoid clutter


async def get_last_match_date(team_id, season=2024):
    data = await api_get("/fixtures", {"team": team_id, "last": 1, "status": "FT", "season": season})
    if not data:
        return None
    # Format: 2024-04-20T14:00:00+00:00
    return data[0]["fixture"]["date"]


def role_counts(injuries):
    roles = {"GK": 0, "DEF": 0, "MID": 0, "ATT": 0}
    for p in injuries:
        if p["position"] in roles:
            roles[p["position"]] += 1
    return roles


async def search_team_id(team_name):
    data = await api_get("/teams", {"search": team_name})
    if not data:
        return None
    return data[0]["team"]["id"]


async def get_lineup(team_id, season=2024):
    # 1. Last match, as a proxy for the current lineup
    data = await api_get("/fixtures", {"team": team_id, "last": 1, "season": season})
    if not data:
        return []

    fixture_id = data[0]["fixture"]["id"]

    # 2. Lineup for that fixture
    data_l = await api_get("/fixtures/lineups", {"fixture": fixture_id, "team": team_id})
    if not data_l:
        return []

    lineup = []
    for p in data_l[0].get("startXI", []):
        player = p["player"]
        lineup.append({
            "id": str(player["id"]),
            "name": player["name"],
            "number": player["number"],
            "pos": player["pos"],  # usually "G", "D", "M", "F"
        })

    return lineup


@cached(ttl_seconds=21600, key_prefix="squad")
async def get_squad(team_id):
    """Fetch full squad roster with player photos and details"""
    data = await api_get("/players/squads", {"team": team_id})
    if not data:
        return []

    squad = []
    for p in data[0].get("players", []):
        position = POSITION_MAP.get(p.get("position"), "MID")

        # The API does not expose a rating here, so estimate from age.
        age = p.get("age") or 25
        base_rating = 75
        if age < 23:
            rating = base_rating + (age - 18)  # Young talent: 75-80
        elif age < 30:
            rating = base_rating + 5 + (30 - age) // 2  # Prime: 78-85
        else:
            rating = base_rating + 3 - (age - 30)  # Veteran: 75-78
        rating = max(65, min(95, rating))

        squad.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "age": p.get("age"),
            "number": p.get("number"),
            "position": position,
            "photo": p.get("photo"),
            "rating": rating,
        })

    return squad


@cached(ttl_seconds=1800, key_prefix="fixtures")
async def get_featured_fixtures():
    """Today's fixtures across the top 5 leagues"""
    today = datetime.now().strftime("%Y-%m-%d")

    data = await api_get("/fixtures", {"date": today})
    if not data:
        return []

    featured = []
    for match in data:
        if match.get("league", {}).get("id") not in TOP_LEAGUE_IDS:
            continue

        featured.append({
            "id": match.get("fixture", {}).get("id"),
            "date": match.get("fixture", {}).get("date"),
            "status": match.get("fixture", {}).get("status", {}).get("short"),
            "home": {
                "id": match.get("teams", {}).get("home", {}).get("id"),
                "name": match.get("teams", {}).get("home", {}).get("name"),
                "logo": match.get("teams", {}).get("home", {}).get("logo"),
            },
            "away": {
                "id": match.get("teams", {}).get("away", {}).get("id"),
                "name": match.get("teams", {}).get("away", {}).get("name"),
                "logo": match.get("teams", {}).get("away", {}).get("logo"),
            },
            "league": {
                "name": match.get("league", {}).get("name"),
                "logo": match.get("league", {}).get("logo"),
            },
            "score": {
                "home": match.get("goals", {}).get("home"),
                "away": match.get("goals", {}).get("away"),
            },
        })

    return featured[:5]


@cached(ttl_seconds=86400, key_prefix="top_players")
async def get_top_players(season=2024):
    """Top impact players across the major leagues, by rating then output"""
    all_players = []

    for league_id in TOP_LEAGUE_IDS:
        data = await api_get("/players/topscorers", {"league": league_id, "season": season})
        if not data:
            continue

        for p in data[:3]:  # Top 3 from each league
            player = p.get("player", {})
            stats = p.get("statistics", [{}])[0]

            raw_rating = stats.get("games", {}).get("rating")
            formatted_rating = f"{float(raw_rating):.1f}" if raw_rating else None

            all_players.append({
                "id": player.get("id"),
                "name": player.get("name"),
                "photo": player.get("photo"),
                "age": player.get("age"),
                "nationality": player.get("nationality"),
                "team": {
                    "name": stats.get("team", {}).get("name"),
                    "logo": stats.get("team", {}).get("logo"),
                },
                "goals": stats.get("goals", {}).get("total") or 0,
                "assists": stats.get("goals", {}).get("assists") or 0,
                "rating": formatted_rating,
            })

    if not all_players:
        return []

    print(f"Fetched {len(all_players)} players across the top leagues")

    all_players.sort(
        key=lambda p: (float(p["rating"] or 0), p["goals"], p["assists"]),
        reverse=True,
    )

    return all_players[:5]


@cached(ttl_seconds=604800, key_prefix="team_colors")
async def get_team_colors(team_id):
    """Team logo plus the app's default accent colours"""
    defaults = {"primary": "#6366f1", "secondary": "#22d3ee"}

    data = await api_get("/teams", {"id": team_id})
    if not data:
        return defaults

    return {**defaults, "logo": data[0].get("team", {}).get("logo")}


async def get_player_stats(player_id, season=2024, league_id=39):
    """Detailed season stats for one player"""
    data = await api_get("/players", {"id": player_id, "season": season, "league": league_id})
    if not data:
        return None

    # response[0] -> { player: {...}, statistics: [{...}] }
    player_data = data[0]
    return {
        "player": player_data["player"],
        "statistics": player_data["statistics"][0],
    }
