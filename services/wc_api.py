"""
World Cup 2026 — external API helpers.

All functions talk to API-Football (v3.football.api-sports.io)
and return structured dicts ready to be served as JSON responses.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from services.external_data import http_client, HEADERS, BASE_URL
from services.cache import cache, cached


# ────────────────────── Constants ──────────────────────
WC_LEAGUE_ID = 1
WC_SEASON = 2026
LIVE_STATUSES = {"1H", "HT", "2H", "ET", "P"}


# ────────────────────── Helpers ──────────────────────

def _format_fixture(match: dict) -> dict:
    """Normalize a raw API-Football fixture into our response shape."""
    fixture = match.get("fixture", {})
    teams = match.get("teams", {})
    goals = match.get("goals", {})
    league = match.get("league", {})
    venue = fixture.get("venue", {})

    return {
        "id": fixture.get("id"),
        "date": fixture.get("date"),
        "status": {
            "long": fixture.get("status", {}).get("long"),
            "short": fixture.get("status", {}).get("short"),
            "elapsed": fixture.get("status", {}).get("elapsed"),
        },
        "round": league.get("round"),
        "home": {
            "id": teams.get("home", {}).get("id"),
            "name": teams.get("home", {}).get("name"),
            "logo": teams.get("home", {}).get("logo"),
            "goals": goals.get("home"),
        },
        "away": {
            "id": teams.get("away", {}).get("id"),
            "name": teams.get("away", {}).get("name"),
            "logo": teams.get("away", {}).get("logo"),
            "goals": goals.get("away"),
        },
        "venue": {
            "name": venue.get("name"),
            "city": venue.get("city"),
        },
        "referee": fixture.get("referee"),
        "group": league.get("round", "").split(" - ")[0] if "Group" in league.get("round", "") else None,
    }


async def _api_get(path: str, params: dict) -> list:
    """Fire a GET against API-Football and return the `response` list.
    
    Returns an empty list on any network / API error so callers never 500.
    """
    try:
        r = await http_client.get(f"{BASE_URL}{path}", headers=HEADERS, params=params)
        return r.json().get("response", [])
    except Exception as e:
        print(f"[WC API] Error fetching {path} params={params}: {e}")
        return []


# ──────────────────── 1. GET /wc/fixtures ────────────────────

async def fetch_wc_fixtures(
    date: Optional[str] = None,
    round: Optional[str] = None,
    status: Optional[str] = None,
) -> dict:
    """
    Fetch World Cup fixtures with optional filters.
    
    Caching strategy:
      - If the requested date is today → 30-second TTL (near-live).
      - Otherwise → 1-hour TTL (schedule is stable).
    """
    params: dict = {"league": WC_LEAGUE_ID, "season": WC_SEASON}
    if date:
        params["date"] = date
    if round:
        params["round"] = round
    if status:
        params["status"] = status

    # Build a deterministic cache key
    cache_key = f"wc:fixtures:{date or 'all'}:{round or 'all'}:{status or 'all'}"

    # Determine TTL
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    is_today = (date == today) or (date is None)
    ttl = 30 if is_today else 3600

    cached_result = cache.get(cache_key)
    if cached_result is not None:
        cached_result["cached"] = True
        return cached_result

    data = await _api_get("/fixtures", params)
    fixtures = [_format_fixture(m) for m in data]

    result = {
        "fixtures": fixtures,
        "total": len(fixtures),
        "cached": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    cache.set(cache_key, result, ttl_seconds=ttl)
    return result


# ──────────────────── 2. GET /wc/live ────────────────────

async def fetch_wc_live() -> dict:
    """Return only currently live World Cup matches. Never cached."""
    params = {"league": WC_LEAGUE_ID, "live": "all"}
    data = await _api_get("/fixtures", params)

    fixtures = []
    for m in data:
        f = _format_fixture(m)
        # Promote elapsed to top level for convenience
        f["elapsed"] = f["status"]["elapsed"]
        fixtures.append(f)

    return {
        "fixtures": fixtures,
        "total": len(fixtures),
        "cached": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────── 3. GET /wc/standings ────────────────────

@cached(ttl_seconds=300, key_prefix="wc_standings")
async def fetch_wc_standings() -> dict:
    """Fetch all World Cup group standings (5-minute cache)."""
    data = await _api_get("/standings", {"league": WC_LEAGUE_ID, "season": WC_SEASON})

    groups: dict[str, list] = {}
    if data:
        # API returns: response[0].league.standings = [[group A rows], [group B rows], ...]
        standings_lists = data[0].get("league", {}).get("standings", [])
        for group_rows in standings_lists:
            for row in group_rows:
                group_name = row.get("group", "Unknown")
                # Strip "Group " prefix → just the letter
                short = group_name.replace("Group ", "").strip()
                entry = {
                    "rank": row.get("rank"),
                    "team": row.get("team", {}).get("name"),
                    "team_id": row.get("team", {}).get("id"),
                    "logo": row.get("team", {}).get("logo"),
                    "played": row.get("all", {}).get("played", 0),
                    "won": row.get("all", {}).get("win", 0),
                    "drawn": row.get("all", {}).get("draw", 0),
                    "lost": row.get("all", {}).get("lose", 0),
                    "gf": row.get("all", {}).get("goals", {}).get("for", 0),
                    "ga": row.get("all", {}).get("goals", {}).get("against", 0),
                    "gd": row.get("goalsDiff", 0),
                    "points": row.get("points", 0),
                    "form": row.get("form"),
                }
                groups.setdefault(short, []).append(entry)

    return {
        "groups": groups,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────── 4. GET /wc/fixture/{id} ────────────────────

async def fetch_wc_fixture_detail(fixture_id: int) -> dict:
    """
    Fetch full detail for one match — fixture, events, lineups, stats
    are fetched in parallel via asyncio.gather (60-second cache).
    """
    cache_key = f"wc:fixture_detail:{fixture_id}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        cached_result["cached"] = True
        return cached_result

    fixture_task = _api_get("/fixtures", {"id": fixture_id})
    events_task = _api_get("/fixtures/events", {"fixture": fixture_id})
    lineups_task = _api_get("/fixtures/lineups", {"fixture": fixture_id})
    stats_task = _api_get("/fixtures/statistics", {"fixture": fixture_id})

    fixture_raw, events_raw, lineups_raw, stats_raw = await asyncio.gather(
        fixture_task, events_task, lineups_task, stats_task
    )

    # Format the main fixture
    fixture = _format_fixture(fixture_raw[0]) if fixture_raw else {}

    # Events — goals, cards, subs
    events = []
    for e in events_raw:
        events.append({
            "time": e.get("time", {}).get("elapsed"),
            "extra_time": e.get("time", {}).get("extra"),
            "team": e.get("team", {}).get("name"),
            "team_id": e.get("team", {}).get("id"),
            "player": e.get("player", {}).get("name"),
            "player_id": e.get("player", {}).get("id"),
            "assist": e.get("assist", {}).get("name"),
            "type": e.get("type"),
            "detail": e.get("detail"),
        })

    # Lineups
    lineups = []
    for l in lineups_raw:
        team_lineup = {
            "team": l.get("team", {}).get("name"),
            "team_id": l.get("team", {}).get("id"),
            "formation": l.get("formation"),
            "start_xi": [
                {
                    "id": p["player"]["id"],
                    "name": p["player"]["name"],
                    "number": p["player"]["number"],
                    "pos": p["player"]["pos"],
                    "grid": p["player"].get("grid"),
                }
                for p in l.get("startXI", [])
            ],
            "substitutes": [
                {
                    "id": p["player"]["id"],
                    "name": p["player"]["name"],
                    "number": p["player"]["number"],
                    "pos": p["player"]["pos"],
                }
                for p in l.get("substitutes", [])
            ],
            "coach": l.get("coach", {}).get("name"),
        }
        lineups.append(team_lineup)

    # Statistics
    statistics = []
    for s in stats_raw:
        team_stats = {
            "team": s.get("team", {}).get("name"),
            "team_id": s.get("team", {}).get("id"),
            "stats": {
                stat["type"]: stat["value"]
                for stat in s.get("statistics", [])
            },
        }
        statistics.append(team_stats)

    result = {
        "fixture": fixture,
        "events": events,
        "lineups": lineups,
        "statistics": statistics,
        "cached": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    cache.set(cache_key, result, ttl_seconds=60)
    return result


# ──────────────────── 5. GET /wc/headtohead ────────────────────

@cached(ttl_seconds=86400, key_prefix="wc_h2h")
async def fetch_wc_headtohead(team1: int, team2: int, last: int = 10) -> dict:
    """Head-to-head between two teams (24-hour cache)."""
    params = {"h2h": f"{team1}-{team2}", "last": last}
    data = await _api_get("/fixtures/headtohead", params)

    fixtures = [_format_fixture(m) for m in data]

    # Build summary
    team1_wins = 0
    team2_wins = 0
    draws = 0
    for f in fixtures:
        home_goals = f["home"]["goals"]
        away_goals = f["away"]["goals"]
        if home_goals is None or away_goals is None:
            continue
        home_id = f["home"]["id"]
        if home_goals > away_goals:
            if home_id == team1:
                team1_wins += 1
            else:
                team2_wins += 1
        elif away_goals > home_goals:
            if home_id == team1:
                team2_wins += 1
            else:
                team1_wins += 1
        else:
            draws += 1

    return {
        "summary": {
            "total_matches": len(fixtures),
            "team1_wins": team1_wins,
            "team2_wins": team2_wins,
            "draws": draws,
        },
        "fixtures": fixtures,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────── 6. GET /wc/injuries ────────────────────

@cached(ttl_seconds=600, key_prefix="wc_injuries")
async def fetch_wc_injuries(team_id: Optional[int] = None) -> dict:
    """WC injuries, optionally filtered by team (10-minute cache)."""
    params: dict = {"league": WC_LEAGUE_ID, "season": WC_SEASON}
    if team_id:
        params["team"] = team_id

    data = await _api_get("/injuries", params)

    pos_map = {
        "Goalkeeper": "GK",
        "Defender": "DEF",
        "Midfielder": "MID",
        "Attacker": "ATT",
    }

    # Group by team
    by_team: dict[str, list] = {}
    for entry in data:
        team_name = entry.get("team", {}).get("name", "Unknown")
        team_logo = entry.get("team", {}).get("logo")
        player = entry.get("player", {})

        injury = {
            "player_id": player.get("id"),
            "name": player.get("name"),
            "photo": player.get("photo"),
            "position": pos_map.get(player.get("type"), "MID"),
            "reason": player.get("reason"),
        }

        if team_name not in by_team:
            by_team[team_name] = {"team_logo": team_logo, "injuries": []}
        # Deduplicate
        if not any(i["name"] == injury["name"] for i in by_team[team_name]["injuries"]):
            by_team[team_name]["injuries"].append(injury)

    return {
        "teams": by_team,
        "total_injuries": sum(len(t["injuries"]) for t in by_team.values()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ──────────────────── 7. GET /wc/topscorers ────────────────────

@cached(ttl_seconds=3600, key_prefix="wc_topscorers")
async def fetch_wc_topscorers() -> dict:
    """Top 10 World Cup 2026 scorers (1-hour cache)."""
    data = await _api_get("/players/topscorers", {"league": WC_LEAGUE_ID, "season": WC_SEASON})

    scorers = []
    for p in data[:10]:
        player = p.get("player", {})
        stats = p.get("statistics", [{}])[0]
        goals_data = stats.get("goals", {})

        raw_rating = stats.get("games", {}).get("rating")
        formatted_rating = f"{float(raw_rating):.1f}" if raw_rating else None

        scorers.append({
            "rank": len(scorers) + 1,
            "player": {
                "id": player.get("id"),
                "name": player.get("name"),
                "firstname": player.get("firstname"),
                "lastname": player.get("lastname"),
                "photo": player.get("photo"),
                "age": player.get("age"),
                "nationality": player.get("nationality"),
            },
            "team": {
                "name": stats.get("team", {}).get("name"),
                "logo": stats.get("team", {}).get("logo"),
            },
            "goals": goals_data.get("total", 0),
            "assists": goals_data.get("assists", 0),
            "appearances": stats.get("games", {}).get("appearences", 0),
            "minutes": stats.get("games", {}).get("minutes", 0),
            "rating": formatted_rating,
        })

    return {
        "scorers": scorers,
        "total": len(scorers),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
