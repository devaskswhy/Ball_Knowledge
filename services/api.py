from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
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
from models.elo_engine import EloEngine
from models.predictor import MatchPredictor
from models.preview import generate_match_preview

# ---------------- DATA LOAD ----------------
DATA_PATH = Path(r"C:\WEB_PROJECTS\Ball_Knowledge\data\premier_league_2023_24.csv")

print("Loading CSV and building engine...")
df = pd.read_csv(DATA_PATH)

df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date").reset_index(drop=True)

# ---------------- TEAM MATCHES ----------------
home_df = df[["date", "home", "home_goals", "away_goals"]].rename(
    columns={"home": "team", "home_goals": "goals_for", "away_goals": "goals_against"}
)
home_df["is_home"] = 1

away_df = df[["date", "away", "home_goals", "away_goals"]].rename(
    columns={"away": "team", "away_goals": "goals_for", "home_goals": "goals_against"}
)
away_df["is_home"] = 0

team_matches = pd.concat([home_df, away_df], ignore_index=True)

def result_points(row):
    if row["goals_for"] > row["goals_against"]:
        return 3
    elif row["goals_for"] < row["goals_against"]:
        return 0
    return 1

team_matches["points"] = team_matches.apply(result_points, axis=1)
team_matches = team_matches.sort_values(["team", "date"]).reset_index(drop=True)

# ---------------- ROLLING STATS ----------------
g = team_matches.groupby("team")

team_matches["gf_last5"] = g["goals_for"].rolling(5, min_periods=1).mean().reset_index(level=0, drop=True)
team_matches["ga_last5"] = g["goals_against"].rolling(5, min_periods=1).mean().reset_index(level=0, drop=True)
team_matches["pts_last5"] = g["points"].rolling(5, min_periods=1).mean().reset_index(level=0, drop=True)
team_matches["gf_last10"] = g["goals_for"].rolling(10, min_periods=1).mean().reset_index(level=0, drop=True)
team_matches["ga_last10"] = g["goals_against"].rolling(10, min_periods=1).mean().reset_index(level=0, drop=True)

final_stats = (
    team_matches.sort_values("date")
    .groupby("team")
    .tail(1)[["team", "gf_last5", "ga_last5", "pts_last5", "gf_last10", "ga_last10"]]
    .reset_index(drop=True)
)

# ---------------- ELO ----------------
elo = EloEngine()
elo.compute_season(df)

elo_df = pd.DataFrame(
    [{"team": t, "elo": v} for t, v in elo.team_elos.items()]
)

# ---------------- POWER SCORE ----------------
tf = final_stats.merge(elo_df, on="team", how="left")

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
tf["power_score"] = 100 * (tf["raw_power"] - mn) / (mx - mn)

power_table = tf[
    ["team", "power_score", "elo", "gf_last10", "ga_last10", "pts_last5"]
].sort_values("power_score", ascending=False)

power_lookup = dict(zip(power_table["team"], power_table["power_score"]))

predictor = MatchPredictor(elo, power_lookup)

print("Startup finished. Teams:", list(power_lookup.keys()))
# ---------------- TEAM ID MAP (API-Football) ----------------
# ---------------- TEAM ID MAP (API-Football) ----------------
# IDs based on standard API-Football mapping for Premier League
TEAM_ID_MAP = {
    "Arsenal": 42,
    "Aston Villa": 66,
    "Bournemouth": 35,
    "Brentford": 55,
    "Brighton": 51,
    "Burnley": 44,
    "Chelsea": 49,
    "Crystal Palace": 52,
    "Everton": 45,
    "Fulham": 36,
    "Liverpool": 40,
    "Luton": 1359,
    "Manchester City": 50,
    "Man City": 50, # Alias
    "Manchester United": 33,
    "Man United": 33, # Alias
    "Newcastle": 34,
    "Nottingham Forest": 65,
    "Sheffield United": 62,
    "Tottenham": 47,
    "West Ham": 48,
    "Wolves": 39,
}


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

# ---------------- ROUTES ----------------
@app.get("/teams")
def get_teams():
    # Return list of teams available in our internal power_lookup
    # This ensures consistency between frontend selection and backend data
    teams = sorted(list(power_lookup.keys()))
    return {"teams": teams}

@app.post("/predict")
def predict(q: MatchQuery):
    if q.home not in power_lookup or q.away not in power_lookup:
        raise HTTPException(status_code=400, detail="Unknown team name")

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
def preview(home: str, away: str):
    text = generate_match_preview(
        home, away, predictor, power_table, final_stats.merge(elo_df, on="team")
    )
    return {"preview": text}

@app.get("/power_table")
def get_power_table():
    return power_table.to_dict(orient="records")
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
from services.external_data import get_last_match_date
from datetime import datetime
import pytz

@app.get("/live_data")
def live_data(home: str, away: str):
    if home not in TEAM_ID_MAP or away not in TEAM_ID_MAP:
        raise HTTPException(status_code=400, detail="One or more teams not mapped")

    hid = TEAM_ID_MAP[home]
    aid = TEAM_ID_MAP[away]

    # 1. Injuries
    h_inj = get_injuries(hid)
    a_inj = get_injuries(aid)

    # 2. Rest Days Calculation
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
        "home_rest": h_rest,
        "away_rest": a_rest
    }

