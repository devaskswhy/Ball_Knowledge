from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import json
from pathlib import Path
from services.external_data import get_injuries, role_counts, get_squad, search_team_id, get_featured_fixtures, get_top_players, get_team_colors, get_player_stats
from services.wc_data import WC_2026_TEAMS, FIFA_RANKINGS
from services.cache import cache


# ---------------- APP ----------------
app = FastAPI(title="BallKnowledge API", version="0.1")

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
from models.preview import generate_match_preview

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
    "WC": "international_matches1.csv", 
}

print("Initializing Leagues...")
loaded_leagues = []
failed_leagues = []

for code, filename in LEAGUE_FILES.items():
    path = DATA_DIR / filename
    if path.exists():
        try:
            league_manager.load_league(code, path)
            loaded_leagues.append(code)
            print(f"    [OK] {code} loaded successfully from {filename}")
        except Exception as e:
            failed_leagues.append(code)
            print(f"    [ERROR] Failed to load {code}: {e}")
    else:
        failed_leagues.append(code)
        print(f"    [WARNING] {code} data not found at {path}. Skipping league.")

# Startup summary
print("\n--- League Load Summary ---")
print(f"Successfully loaded: {', '.join(loaded_leagues) if loaded_leagues else 'None'}")
print(f"Failed to load: {', '.join(failed_leagues) if failed_leagues else 'None'}")
print("--- End Summary ---\n")


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

    if league == "WC":
        # Filter for WC 2026 teams only
        team_names = [t for t in team_names if t in WC_2026_TEAMS]
        # Also add any confirmed teams that might be missing from power_lookup but are in our whitelist
        # (This handles the case where LeagueManager only loaded confirmed historical power data)
        for t in WC_2026_TEAMS:
            if t not in team_names and t in TEAM_ID_MAP:
                 team_names.append(t)
        team_names = sorted(list(set(team_names))) # Dedupe and sort
    
    # Map to objects with IDs for Badges
    
    # Map to objects with IDs for Badges
    teams_data = []
    
    # Pre-fetch rankings if WC
    for name in team_names:
        tid = TEAM_ID_MAP.get(name)
        t_obj = {
            "name": name,
            "id": tid
        }
        
        if league == "WC":
            t_obj["rank"] = FIFA_RANKINGS.get(name, 999)
            
        teams_data.append(t_obj)
        
    # Sort by rank if World Cup
    if league == "WC":
        teams_data.sort(key=lambda x: x.get("rank", 999))
        
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

# ---------------- WC GROUPS ----------------
@app.get("/wc_groups")
def get_wc_expected_groups():
    """Generate Expected World Cup Groups based on FIFA Rankings"""
    # 1. Gather all WC 2026 teams
    teams = []
    
    # Use IDs from map
    for name in WC_2026_TEAMS:
        if name in TEAM_ID_MAP:
            # Get rank
            rank = FIFA_RANKINGS.get(name, 100)
            teams.append({
                "name": name,
                "id": TEAM_ID_MAP[name],
                "rank": rank
            })
    
    # 2. Sort by Rank
    teams.sort(key=lambda x: x["rank"])
    
    # 3. Create Pots (Assuming 48 teams? User implementation shows ~32 for now in example)
    # We will just distribute them into Groups A-H (8 groups of 4 = 32 teams)
    # Or however many fit.
    
    groups_data = []
    group_names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
    
    # Snake draft or simple alternating? 
    # Let's do a simple "Seeded" distribution (Pot 1 to Group A-H, Pot 2 to A-H...)
    
    num_groups = 8 # Fit 32 teams
    # If we have more teams, we add more groups
    if len(teams) > 32:
        num_groups = 12 # 48 team format (12 groups of 4)
        
    # Initialize groups
    for i in range(num_groups):
        groups_data.append({
            "name": f"Group {group_names[i]}",
            "teams": []
        })
        
    # Distribute
    # For a realistic draw, we would use Pots.
    # Pot 1: Top N teams
    # Pot 2: Next N teams
    # ...
    
    for i, team in enumerate(teams):
        # Determine group index. 
        # Simple distribution: 0, 1, 2... 7, 0, 1, 2...
        group_idx = i % num_groups
        groups_data[group_idx]["teams"].append(team)
        
    return groups_data

# ---------------- CACHE STATS ----------------
@app.get("/cache/stats")
def get_cache_stats():
    """Get cache statistics and current contents for debugging"""
    return cache.get_stats()

# ---------------- LIVE DATA ----------------




