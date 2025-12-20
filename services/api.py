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
TEAM_ID_MAP = {
    "Manchester City": 50,
    "Man City": 50,

    "Arsenal": 42,

    "Liverpool": 40,

    "Tottenham": 47,
    "Totenham": 47,

    "Chelsea": 49,
}


# ---------------- API MODELS ----------------
class MatchQuery(BaseModel):
    home: str
    away: str

# ---------------- ROUTES ----------------
@app.post("/predict")
def predict(q: MatchQuery):
    if q.home not in power_lookup or q.away not in power_lookup:
        raise HTTPException(status_code=400, detail="Unknown team name")

    res = predictor.predict_match(q.home, q.away)
    return {
        "home": res["home"],
        "away": res["away"],
        "home_win": round(res["home_win"] * 100, 1),
        "draw": round(res["draw"] * 100, 1),
        "away_win": round(res["away_win"] * 100, 1),
        "elo_diff": round(res["elo_diff"], 1),
        "power_diff": round(res["power_diff"], 1),
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

