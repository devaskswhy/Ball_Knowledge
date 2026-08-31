from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
import pandas as pd
import json
from pathlib import Path
from datetime import datetime, timezone
import asyncio
import time
import os
from services.external_data import (
    get_injuries,
    role_counts,
    get_squad,
    search_team_id,
    get_featured_fixtures,
    get_top_players,
    get_player_stats,
    request_budget,
)
from services.cache import cache
from services.database import get_db, init_db
from services.models import Match, Prediction, Team, Player
from services.scheduler import setup_scheduler, get_scheduler_status


# ---------------- LIFESPAN CONTEXT MANAGER ----------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("\n--- Starting BallKnowledge API ---")
    tables = init_db()
    print("--- Database ready: " + ", ".join(tables) + " ---")
    scheduler = setup_scheduler()
    scheduler.start()
    print("--- Scheduler started ---")
    yield
    # Shutdown
    print("\n--- Shutting down BallKnowledge API ---")
    scheduler.shutdown()
    print("--- Scheduler stopped ---")


# ---------------- APP ----------------
app = FastAPI(title="BallKnowledge API", version="0.1", lifespan=lifespan)

print("\n--- API FILE LOADED FROM:", __file__, "---\n")

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- IMPORT MODELS ----------------
from services.league_manager import LeagueManager
from services.standings import COMPETITIONS, get_standings_source
from services.simulator import title_race
from services.bracket import bracket
from services.ucl import load_ucl
from services import ai as ai_service

# ---------------- DATA LOAD ----------------
league_manager = LeagueManager()

DATA_DIR = Path(__file__).parent.parent / "data"

# Define Leagues and their CSV paths
LEAGUE_FILES = {
    "PL": "E0.csv",
    "LL": "SP1.csv",
    "SA": "I1.csv",
    "L1": "F1.csv",
    "BL": "D1.csv",
}
assert set(LEAGUE_FILES) <= set(COMPETITIONS), "CSV map and competition registry disagree"

print("Initializing Leagues...")
loaded_leagues = []
failed_leagues = []

# data/<season>/<code>.csv, e.g. data/2627/E0.csv. Oldest first, so the newest
# season is the current table and the older ones only inform Elo and form.
# Falls back to the flat data/<code>.csv layout if no season folders exist.
SEASON_DIRS = sorted(
    p for p in DATA_DIR.iterdir()
    if p.is_dir() and len(p.name) == 4 and p.name.isdigit()
)

for code, filename in LEAGUE_FILES.items():
    paths = [d / filename for d in SEASON_DIRS if (d / filename).exists()]
    if not paths and (DATA_DIR / filename).exists():
        paths = [DATA_DIR / filename]

    if not paths:
        failed_leagues.append(code)
        print(f"    [WARNING] {code}: no data found for {filename}. Skipping league.")
        continue

    try:
        league_manager.load_league(code, paths)
        if league_manager.get_league(code):
            loaded_leagues.append(code)
            seasons = ", ".join(p.parent.name for p in paths)
            print(f"    [OK] {code} loaded from {filename} (seasons: {seasons})")
        else:
            failed_leagues.append(code)
            print(f"    [ERROR] {code} produced no usable league")
    except Exception as e:
        failed_leagues.append(code)
        print(f"    [ERROR] Failed to load {code}: {e}")

# Champions League: a committed snapshot, zero API calls
if load_ucl(league_manager):
    loaded_leagues.append("UCL")
    print("    [OK] UCL loaded from data/ucl_2024.json (snapshot, 0 API calls)")
else:
    failed_leagues.append("UCL")

# Startup summary
print("\n--- League Load Summary ---")
print(f"Successfully loaded: {', '.join(loaded_leagues) if loaded_leagues else 'None'}")
print(f"Failed to load: {', '.join(failed_leagues) if failed_leagues else 'None'}")
print("--- End Summary ---\n")

ai_service.configure(league_manager)


# ---------------- TEAM ID MAP (API-Football) ----------------
# We need to expand this mapping for other leagues.
# Ideally this should be a large Dictionary or Database.
TEAM_ID_MAP = {
    # PL
    "Manchester City": 50, "Man City": 50,
    "Arsenal": 42,
    "Liverpool": 40,
    "Tottenham": 47, "Totenham": 47,
    "Chelsea": 49,
    "Manchester United": 33, "Man United": 33,
    "Newcastle": 34,
    "Aston Villa": 66,
    "Brighton": 51,
    "West Ham": 48,
    "Brentford": 55,
    "Crystal Palace": 52,
    "Wolves": 39,
    "Fulham": 36,
    "Bournemouth": 35,
    "Everton": 45,
    "Nottingham Forest": 65, "Nottm Forest": 65,
    "Burnley": 44,
    "Sheffield United": 62,
    "Luton": 1359,
    
    # La Liga (Examples)
    "Real Madrid": 541,
    "Barcelona": 529,
    "Atlético Madrid": 530,
    
    # Serie A
    "Juventus": 496,
    "AC Milan": 489,
    "Inter": 505,
    
    # Ligue 1
    "PSG": 85,
    "Paris Saint-Germain": 85,

    # Bundesliga (names match D1.csv exactly, with aliases for common variants)
    "Bayern Munich": 157,
    "Borussia Dortmund": 165, "Dortmund": 165,
    "Bayer Leverkusen": 168, "Leverkusen": 168,
    "RB Leipzig": 173,
    "Eintracht Frankfurt": 169, "Ein Frankfurt": 169, "Frankfurt": 169,
    "VfL Wolfsburg": 161, "Wolfsburg": 161,
    "Borussia Monchengladbach": 163, "M'gladbach": 163, "Gladbach": 163,
    "SC Freiburg": 160, "Freiburg": 160,
    "Union Berlin": 182,
    "VfB Stuttgart": 172, "Stuttgart": 172,
    "TSG Hoffenheim": 167, "Hoffenheim": 167,
    "FC Augsburg": 170, "Augsburg": 170,
    "Mainz": 164, "Mainz 05": 164,
    "Werder Bremen": 162, "Bremen": 162,
    "FC Koln": 192, "FC Cologne": 192, "Cologne": 192,
    "Schalke 04": 174, "Schalke": 174,
    "Hertha Berlin": 159, "Hertha BSC": 159, "Hertha": 159,
    "Bochum": 176,
    "Heidenheim": 811,
    "Darmstadt": 779,
    "Hamburg": 180, "HSV": 180,
    "St Pauli": 186,
}

# ---------------- LOAD DYNAMIC ID MAP ----------------
TEAM_MAP_FILE = DATA_DIR / "team_id_map.json"
if TEAM_MAP_FILE.exists():
    try:
        with open(TEAM_MAP_FILE, "r") as f:
            dynamic_map = json.load(f)
            print(f"Loaded {len(dynamic_map)} teams from team_id_map.json")
            # Update the main map
            TEAM_ID_MAP.update(dynamic_map)
    except Exception as e:
        print(f"Error loading team map: {e}")


# ---------------- API MODELS ----------------
class Injury(BaseModel):
    name: str = "Unknown"
    position: str = "MID"  # GK, DEF, MID, ATT
    impact: int = 5        # 1-10

class MatchQuery(BaseModel):
    home: str
    away: str
    home_injuries: list[Injury] = []
    away_injuries: list[Injury] = []
    home_rest_days: int = 7
    away_rest_days: int = 7
    league: str = "PL" # Default to PL

# ---------------- ROUTES ----------------
@app.get("/teams")
def get_teams(league: str = "PL"):
    """List the teams we hold power scores for in a given league."""
    ctx = league_manager.get_league(league)
    if not ctx:
        return {"teams": []}

    team_names = sorted(ctx["power_lookup"].keys())
    teams_data = [
        {"name": name, "id": TEAM_ID_MAP.get(name)}
        for name in team_names
    ]
    return {"teams": teams_data}

@app.get("/squad")
async def get_team_squad(team: str):
    """Get full squad roster with player photos and ratings, plus real lineup"""
    from services.external_data import get_lineup
    
    # Resolve team name to ID
    team_id = TEAM_ID_MAP.get(team)
    
    if not team_id:
        # Try searching API
        team_id = await search_team_id(team)
        if team_id:
            TEAM_ID_MAP[team] = team_id  # Cache for future
    
    if not team_id:
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found")
    
    squad = await get_squad(team_id)
    
    if not squad:
        raise HTTPException(status_code=404, detail=f"No squad data available for '{team}'")
    
    # Get actual lineup from last match
    lineup = await get_lineup(team_id)
    lineup_ids = [int(p["id"]) for p in lineup] if lineup else []
    
    return {"team": team, "squad": squad, "lineup_ids": lineup_ids}

@app.get("/homepage")
async def get_homepage_data():
    """Get data for the homepage: featured fixtures, top players"""
    fixtures = await get_featured_fixtures()
    top_players = await get_top_players(season=2024)  # Fetch from all major leagues
    
    # Get player of the week (top scorer with best stats)
    player_of_week = top_players[0] if top_players else None
    
    return {
        "featured_fixtures": fixtures,
        "top_players": top_players[:5],
        "player_of_week": player_of_week
    }

@app.post("/predict")
def predict(q: MatchQuery, db = Depends(get_db)):
    ctx = league_manager.get_league(q.league)
    if not ctx:
        raise HTTPException(status_code=404, detail=f"League '{q.league}' not loaded or data missing.")
    
    predictor = ctx["predictor"]
    power_lookup = ctx["power_lookup"]

    if q.home not in power_lookup or q.away not in power_lookup:
        # Fallback: Try to predict without power scores if teams are missing from CSV but defined
        # For now error out
        raise HTTPException(status_code=400, detail=f"Unknown team name in {q.league}: '{q.home}' or '{q.away}'")

    # dict conversion for the predictor
    h_inj = [i.dict() for i in q.home_injuries]
    a_inj = [i.dict() for i in q.away_injuries]

    res = predictor.predict_match(
        q.home, q.away, h_inj, a_inj, q.home_rest_days, q.away_rest_days
    )

    goals = ctx["goal_model"].match_report(
        q.home,
        q.away,
        home_power_loss=res.get("home_penalty", 0) + max(res.get("home_fatigue", 0), 0),
        away_power_loss=res.get("away_penalty", 0) + max(res.get("away_fatigue", 0), 0),
    )
    
    # Store prediction in database
    prediction = Prediction(
        home_win_prob=res["home_win"],
        draw_prob=res["draw"],
        away_win_prob=res["away_win"],
        elo_diff=res["elo_diff"],
        power_diff=res["power_diff"],
        model_version="v1.0"
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    
    return {
        "home": res["home"],
        "away": res["away"],
        "home_win": round(res["home_win"] * 100, 1),
        "draw": round(res["draw"] * 100, 1),
        "away_win": round(res["away_win"] * 100, 1),
        "elo_diff": round(res["elo_diff"], 1),
        "power_diff": round(res["power_diff"], 1),
        "home_penalty": round(res.get("home_penalty", 0), 1),
        "away_penalty": round(res.get("away_penalty", 0), 1),
        "home_fatigue": round(res.get("home_fatigue", 0), 1),
        "away_fatigue": round(res.get("away_fatigue", 0), 1),
        "prediction_id": prediction.id,
        **goals,
    }

class PreviewQuery(BaseModel):
    home: str
    away: str
    league: str = "PL"

class TitleRaceAskQuery(BaseModel):
    league: str = "PL"

class AskQuery(BaseModel):
    question: str


@app.post("/ai/preview")
def ai_preview(q: PreviewQuery):
    """Streamed, Claude-narrated preview of an already-computed prediction.

    The model never sees raw team data — only the prediction and expected
    goals our own models already produced — and is instructed never to state
    a number that isn't in that payload.
    """
    ctx = league_manager.get_league(q.league)
    if not ctx:
        raise HTTPException(status_code=404, detail=f"League '{q.league}' not loaded or data missing.")

    power_lookup = ctx["power_lookup"]
    if q.home not in power_lookup or q.away not in power_lookup:
        raise HTTPException(status_code=400, detail=f"Unknown team name in {q.league}: '{q.home}' or '{q.away}'")

    res = ctx["predictor"].predict_match(q.home, q.away)
    goals = ctx["goal_model"].match_report(q.home, q.away)
    prediction = {
        "home_win": round(res["home_win"] * 100, 1),
        "draw": round(res["draw"] * 100, 1),
        "away_win": round(res["away_win"] * 100, 1),
    }

    generator = ai_service.preview_stream(q.home, q.away, q.league, prediction, goals)
    return StreamingResponse(generator, media_type="text/event-stream")


@app.post("/ai/title_race")
def ai_title_race(q: TitleRaceAskQuery):
    """Title-race numbers plus a short Claude narration of the same numbers."""
    meta = COMPETITIONS.get(q.league)
    if meta and meta["kind"] == "cup":
        raise HTTPException(status_code=400, detail=f"'{q.league}' is a knockout competition - use /bracket instead")

    ctx = league_manager.get_league(q.league)
    if not ctx:
        raise HTTPException(status_code=404, detail=f"Competition '{q.league}' has no data loaded")

    race = title_race(ctx, q.league)
    try:
        narration = ai_service.narrate_title_race(q.league, race)
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        narration = {"summary": None, "error": str(e)}

    return {"data": race, "ai": narration}


@app.post("/ai/ask")
async def ai_ask(q: AskQuery):
    """Free-form football Q&A. Claude calls read-only tools for every number
    it uses; nothing here lets it compute or invent one.
    """
    try:
        result = await asyncio.to_thread(ai_service.ask, q.question)
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    return result

@app.get("/standings")
def get_standings(league: str = "PL"):
    """Current league table, computed from played results."""
    source = get_standings_source(league)
    if not source:
        raise HTTPException(status_code=404, detail=f"Unknown competition '{league}'")

    ctx = league_manager.get_league(league)
    if not ctx:
        raise HTTPException(status_code=404, detail=f"Competition '{league}' has no data loaded")

    return source(ctx)


@app.get("/competitions")
def get_competitions():
    """Every competition the API can serve."""
    return {
        "competitions": [
            {"code": code, **meta, "loaded": code in loaded_leagues}
            for code, meta in COMPETITIONS.items()
        ]
    }


@app.get("/title_race")
def get_title_race(league: str = "PL"):
    """Monte Carlo projection of the remaining season."""
    meta = COMPETITIONS.get(league)
    if meta and meta["kind"] == "cup":
        raise HTTPException(
            status_code=400,
            detail=f"'{league}' is a knockout competition - use /bracket instead",
        )

    ctx = league_manager.get_league(league)
    if not ctx:
        raise HTTPException(status_code=404, detail=f"Competition '{league}' has no data loaded")

    return title_race(ctx, league)


@app.get("/bracket")
def get_bracket(competition: str = "UCL"):
    """Knockout projection for a cup competition."""
    meta = COMPETITIONS.get(competition)
    if not meta or meta["kind"] != "cup":
        raise HTTPException(status_code=404, detail=f"'{competition}' is not a knockout competition")

    ctx = league_manager.get_league(competition)
    if not ctx:
        raise HTTPException(status_code=404, detail=f"Competition '{competition}' has no data loaded")

    return bracket(ctx, competition)


@app.get("/power_table")
def get_power_table(league: str = "PL"):
    ctx = league_manager.get_league(league)
    if not ctx:
        return []
    return ctx["power_table"].to_dict(orient="records")
# ---------------- AUTO INJURIES ----------------
@app.get("/auto_injuries")
async def auto_injuries(team: str):
    if team not in TEAM_ID_MAP:
        raise HTTPException(status_code=400, detail="Team not mapped yet")

    team_id = TEAM_ID_MAP[team]
    injuries = await get_injuries(team_id)
    roles = role_counts(injuries)

    return {
        "team": team,
        "injuries": injuries,
        "role_counts": roles
    }

@app.get("/player_stats")
async def get_player_stats_endpoint(player_id: int, season: int = 2024, league: int = 39):
    """Get detailed player stats for a specific season and league"""
    stats = await get_player_stats(player_id, season, league)
    if not stats:
        # Return empty or specific structure to handle "no data" gracefully
        return {"player": {}, "statistics": {}}
    return stats

# ---------------- CACHE STATS ----------------
@app.get("/cache/stats")
def get_cache_stats():
    """Get cache statistics and current contents for debugging"""
    return cache.get_stats()

@app.delete("/cache/clear")
async def clear_cache():
    """Clear all cache entries. Returns stats before clearing."""
    before = cache.stats()
    cache.clear_all()
    return {"message": "Cache cleared", "cleared_keys": before["active_keys"]}

# ---------------- HEALTH CHECK ----------------
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": time.time(),
        "cache": cache.stats(),
        "api_budget": request_budget(),
        "ai_budget": ai_service.ai_budget(),
        "leagues_loaded": loaded_leagues,
        "env": {
            "has_api_sports_key": bool(os.getenv("API_SPORTS_KEY") or os.getenv("API_FOOTBALL_KEY")),
            "data_dir_exists": os.path.isdir(DATA_DIR)
        }
    }

# ---------------- SCHEDULER STATUS ----------------
@app.get("/scheduler/status")
def get_scheduler_status_endpoint():
    """Get scheduler status showing job next run times and last run times"""
    return get_scheduler_status()

# ---------------- WEBSOCKET LIVE SCORES ----------------
@app.websocket("/ws/live")
async def live_scores_ws(websocket: WebSocket):
    """WebSocket endpoint for live score updates"""
    await websocket.accept()
    
    try:
        while True:
            # Send heartbeat ping every 30 seconds
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping", "timestamp": datetime.now(timezone.utc).isoformat()})
            
            # Fetch live scores every 60 seconds (after first ping)
            await asyncio.sleep(30)
            
            try:
                # Try to get live fixtures from cache or fetch fresh
                from datetime import datetime
                today = datetime.now().strftime("%Y-%m-%d")
                cache_key = f"fixtures:{today}"
                fixtures = cache.get(cache_key)
                
                if not fixtures:
                    fixtures = await get_featured_fixtures()
                
                # Filter for live matches (status: 1H, HT, 2H, ET, P)
                live_statuses = ["1H", "HT", "2H", "ET", "P"]
                live_matches = [f for f in fixtures if f.get("status") in live_statuses]
                
                await websocket.send_json({
                    "type": "live_scores",
                    "matches": live_matches,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
            except Exception as e:
                print(f"Error fetching live scores: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Failed to fetch live scores",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass
