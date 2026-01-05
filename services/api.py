from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import json
from pathlib import Path
from services.external_data import get_injuries, role_counts


# ---------------- APP ----------------
app = FastAPI(title="BallKnowledge API", version="0.1")

print("\n🔥🔥 API FILE LOADED FROM:", __file__, "🔥🔥\n")

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
from models.preview import generate_match_preview

# ---------------- DATA LOAD ----------------
league_manager = LeagueManager()

DATA_DIR = Path(r"C:\WEB_PROJECTS\Ball_Knowledge\data")

# Define Leagues and their CSV paths
LEAGUE_FILES = {
    "PL": "E0.csv",
    "LL": "SP1.csv",
    "SA": "I1.csv",
    "L1": "F1.csv",
    "WC": "international_matches1.csv", 
}

print("Initializing Leagues...")
for code, filename in LEAGUE_FILES.items():
    path = DATA_DIR / filename
    # For now, if file doesn't exist, we skip or fallback.
    # To demonstrate functionality without all files, we can optionally use the PL file for others if needed
    # but strictly we should check existence.
    if path.exists():
        league_manager.load_league(code, path)
    else:
        print(f"⚠️ Placeholder: {code} data not found at {path}. (Upload data to enable)")
        # Fallback for Demo: Load PL data for other leagues if missing, JUST FOR DEMO purposes
        # so the UI doesn't crash if the user selects them.
        # REMOVE THIS IN PRODUCTION
        if code != "PL" and (DATA_DIR / "premier_league_2023_24.csv").exists():
             print(f"   -> Loading PL data as fallback for {code} (DEMO MODE)")
             league_manager.load_league(code, DATA_DIR / "premier_league_2023_24.csv")


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
    
    # National Teams (World Cup)
    "Argentina": 26,
    "France": 2,
    "Brazil": 6,
    "England": 10,
    "Germany": 25,
    "Spain": 9    
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
    # Return list of teams available in our internal power_lookup for a given league
    ctx = league_manager.get_league(league)
    if not ctx:
        return {"teams": []} # Or raise HTTPException
    
    team_names = sorted(list(ctx["power_lookup"].keys()))
    
    # Map to objects with IDs for Badges
    teams_data = []
    for name in team_names:
        tid = TEAM_ID_MAP.get(name)
        teams_data.append({
            "name": name,
            "id": tid
        })
        
    return {"teams": teams_data}

@app.post("/predict")
def predict(q: MatchQuery):
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
    }

@app.get("/preview")
def preview(home: str, away: str, league: str = "PL"):
    ctx = league_manager.get_league(league)
    if not ctx:
        raise HTTPException(status_code=404, detail="League not found")
        
    predictor = ctx["predictor"]
    power_table = ctx["power_table"]
    elo_df = ctx["elo_df"]
    final_stats = ctx["final_stats"]
    
    # We need a merged dataframe for generate_match_preview
    # In initial code it was: final_stats.merge(elo_df, on="team")
    # In LeagueManager we have them.
    merged = final_stats.merge(elo_df, on="team")

    text = generate_match_preview(
        home, away, predictor, power_table, merged
    )
    return {"preview": text}

@app.get("/power_table")
def get_power_table(league: str = "PL"):
    ctx = league_manager.get_league(league)
    if not ctx:
        return []
    return ctx["power_table"].to_dict(orient="records")
# ---------------- AUTO INJURIES ----------------
@app.get("/auto_injuries")
def auto_injuries(team: str):
    if team not in TEAM_ID_MAP:
        raise HTTPException(status_code=400, detail="Team not mapped yet")

    team_id = TEAM_ID_MAP[team]
    injuries = get_injuries(team_id)
    roles = role_counts(injuries)

    return {
        "team": team,
        "injuries": injuries,
        "role_counts": roles
    }

# ---------------- LIVE DATA ----------------
from services.external_data import get_last_match_date, search_team_id, get_lineup
from datetime import datetime
import pytz

@app.get("/live_data")
def live_data(home: str, away: str):
    # Dynamic ID resolution
    for team_name in [home, away]:
        if team_name not in TEAM_ID_MAP:
            print(f"Searching API for ID of '{team_name}'...")
            found_id = search_team_id(team_name)
            if found_id:
                TEAM_ID_MAP[team_name] = found_id
                print(f" -> Found ID: {found_id}")
            else:
                print(f" -> ID not found for '{team_name}'")

    if home not in TEAM_ID_MAP or away not in TEAM_ID_MAP:
        raise HTTPException(status_code=404, detail="Could not find API ID for one or more teams.")

    hid = TEAM_ID_MAP[home]
    aid = TEAM_ID_MAP[away]

    # 1. Injuries
    h_inj = get_injuries(hid)
    a_inj = get_injuries(aid)

    # 2. Lineups (Active/Last Match)
    h_lineup = get_lineup(hid)
    a_lineup = get_lineup(aid)

    # 3. Rest Days Calculation
    def calc_rest(tid):
        last_date_str = get_last_match_date(tid)
        if not last_date_str:
            return 7 # Default
        
        # Parse ISO format: 2024-04-20T15:00:00+00:00
        # We need to be careful with timezones.
        try:
            last_date = datetime.fromisoformat(last_date_str)
            # For this project, we'll assume "Now" is the time of the request
            # But since the data is 2023-24 season, "Now" might be far ahead.
            # If the gap is huge (> 30 days), assume it's a new season or break -> 7 days.
            now = datetime.now(pytz.utc)
            delta = (now - last_date).days
            
            if delta > 30 or delta < 0:
                return 7
            return max(1, delta)
        except Exception as e:
            print(f"Date parse error: {e}")
            return 7

    h_rest = calc_rest(hid)
    a_rest = calc_rest(aid)

    return {
        "home_injuries": h_inj,
        "away_injuries": a_inj,
        "home_lineup": h_lineup,
        "away_lineup": a_lineup,
        "home_rest": h_rest,
        "away_rest": a_rest
    }

