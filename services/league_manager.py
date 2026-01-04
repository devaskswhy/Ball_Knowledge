import pandas as pd
from pathlib import Path
from models.elo_engine import EloEngine
from models.predictor import MatchPredictor

class LeagueManager:
    def __init__(self):
        self.leagues = {} # { "PL": { "predictor": ..., "power_table": ... } }

    def load_league(self, league_code, csv_path):
        print(f"Loading League: {league_code} from {csv_path}...")
        path = Path(csv_path)
        if not path.exists():
            print(f"⚠️ CSV NOT FOUND: {csv_path} (Skipping)")
            return

        try:
            df = pd.read_csv(path, encoding='latin1') # Handle potential encoding issues
        except Exception as e:
            print(f"Error reading CSV {path}: {e}")
            return

        # ---------------- COLUMN MAPPING ----------------
        # Standardize columns to: date, home, away, home_goals, away_goals
        rename_map = {}
        
        # 1. Check for standard Football-Data.co.uk format (HomeTeam, FTHG...)
        if "HomeTeam" in df.columns:
            rename_map = {
                "Date": "date",
                "HomeTeam": "home",
                "AwayTeam": "away",
                "FTHG": "home_goals",
                "FTAG": "away_goals"
            }
        
        # 2. Check for International Matches format (Home Team, Home Goals...)
        elif "Home Team" in df.columns:
            rename_map = {
                "Date": "date",
                "Home Team": "home",
                "Away Team": "away",
                "Home Goals": "home_goals",
                "Away Goals": "away_goals"
            }
        
        df = df.rename(columns=rename_map)
        
        # Validate required columns exist
        required = ["date", "home", "away", "home_goals", "away_goals"]
        if not all(c in df.columns for c in required):
            print(f"⚠️ Missing columns in {csv_path}. Found: {df.columns.tolist()}")
            return

        # ---------------- DATE PARSING ----------------
        # Try parse with dayfirst=True (handles YYYY-MM-DD and DD/MM/YYYY correctly usually)
        try:
            # Save original for debugging/fallback if needed (though we already renamed)
            # Use 'mixed' format if available in pandas version, else fallback
            try:
                df["date"] = pd.to_datetime(df["date"], dayfirst=True, format="mixed", errors='coerce')
            except ValueError:
                # Fallback for older pandas
                df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors='coerce')
                
        except Exception as e:
             print(f"Date parsing error: {e}")
        
        df = df.dropna(subset=["date"])
        df = df.sort_values("date").reset_index(drop=True)

        if df.empty:
            print(f"⚠️ League {league_code} has no valid data after processing (Check Date formats).")
            return

        # ---------------- FILTERING ----------------
        # For World Cup / International, filter to recent history (e.g., post-2020)
        # otherwise Elo calculation takes too long and includes 1900s data.
        if league_code == "WC":
             df = df[df["date"].dt.year >= 2020].reset_index(drop=True)

        # 1. Elo Engine
        elo = EloEngine()
        elo.compute_season(df)
        
        # Ensure DataFrame has columns even if empty
        data_list = [{"team": t, "elo": v} for t, v in elo.team_elos.items()]
        elo_df = pd.DataFrame(data_list, columns=["team", "elo"])

        # 2. Rolling Stats & Power Table
        # (Re-using logic from original api.py, encapsulated here)
        final_stats = self._compute_stats(df)
        
        if final_stats.empty:
             print(f"⚠️ League {league_code}: Could not compute stats (Not enough matches?).")
             return

        # Merge
        tf = final_stats.merge(elo_df, on="team", how="left")
        
        # Power Score Calculation
        tf["defence_strength"] = -tf["ga_last10"]
        tf["attack_strength"] = tf["gf_last10"]
        tf["form_strength"] = tf["pts_last5"]
        tf["elo_strength"] = tf["elo"]

        for c in ["elo_strength", "attack_strength", "defence_strength", "form_strength"]:
            mn, mx = tf[c].min(), tf[c].max()
            if mn == mx:
                 tf[c + "_norm"] = 0.5
            else:
                 tf[c + "_norm"] = (tf[c] - mn) / (mx - mn)

        tf["raw_power"] = (
            0.4 * tf["elo_strength_norm"]
            + 0.25 * tf["attack_strength_norm"]
            + 0.2 * tf["defence_strength_norm"]
            + 0.15 * tf["form_strength_norm"]
        )

        mn, mx = tf["raw_power"].min(), tf["raw_power"].max()
        if mn == mx:
            tf["power_score"] = 50
        else:
            tf["power_score"] = 100 * (tf["raw_power"] - mn) / (mx - mn)

        power_table = tf[["team", "power_score", "elo", "gf_last10", "ga_last10", "pts_last5"]].sort_values("power_score", ascending=False)
        power_lookup = dict(zip(power_table["team"], power_table["power_score"]))

        # 3. Predictor
        predictor = MatchPredictor(elo, power_lookup)

        self.leagues[league_code] = {
            "predictor": predictor,
            "power_table": power_table,
            "power_lookup": power_lookup,
            "elo_df": elo_df,
            "final_stats": final_stats
        }
        print(f"✅ League {league_code} loaded. {len(power_lookup)} teams.")

    def _compute_stats(self, df):
        # Helper to compute rolling stats (moved from api.py)
        # Prepare home/away frames
        home_df = df[["date", "home", "home_goals", "away_goals"]].rename(
            columns={"home": "team", "home_goals": "goals_for", "away_goals": "goals_against"}
        )
        away_df = df[["date", "away", "home_goals", "away_goals"]].rename(
            columns={"away": "team", "away_goals": "goals_for", "home_goals": "goals_against"}
        )
        team_matches = pd.concat([home_df, away_df], ignore_index=True)

        def result_points(row):
            if row["goals_for"] > row["goals_against"]: return 3
            elif row["goals_for"] < row["goals_against"]: return 0
            return 1

        team_matches["points"] = team_matches.apply(result_points, axis=1)
        team_matches = team_matches.sort_values(["team", "date"]).reset_index(drop=True)

        g = team_matches.groupby("team")
        team_matches["pts_last5"] = g["points"].rolling(5, min_periods=1).mean().reset_index(level=0, drop=True)
        team_matches["gf_last10"] = g["goals_for"].rolling(10, min_periods=1).mean().reset_index(level=0, drop=True)
        team_matches["ga_last10"] = g["goals_against"].rolling(10, min_periods=1).mean().reset_index(level=0, drop=True)

        return (
            team_matches.sort_values("date")
            .groupby("team")
            .tail(1)[["team", "pts_last5", "gf_last10", "ga_last10"]]
            .reset_index(drop=True)
        )

    def get_league(self, code):
        return self.leagues.get(code)
