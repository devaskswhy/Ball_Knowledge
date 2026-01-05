import sys
import os
import json
import pandas as pd
from pathlib import Path
import time

# Add parent directory to path to import services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.external_data import search_team_id

DATA_DIR = Path(r"C:\WEB_PROJECTS\Ball_Knowledge\data")
OUTPUT_FILE = DATA_DIR / "team_id_map.json"

def get_unique_teams():
    teams = set()
    print("Scaning CSVs for teams...")
    for file in DATA_DIR.glob("*.csv"):
        print(f"  -> Reading {file.name}")
        try:
            # Try Latin1 then UTF-8
            try:
                df = pd.read_csv(file, encoding='latin1')
            except:
                df = pd.read_csv(file, encoding='utf-8')
            
            # Check for HomeTeam or Home Team
            if "HomeTeam" in df.columns:
                teams.update(df["HomeTeam"].dropna().unique())
            elif "Home Team" in df.columns:
                teams.update(df["Home Team"].dropna().unique())
            
        except Exception as e:
            print(f"Error reading {file}: {e}")
            
    return sorted(list(teams))

def main():
    teams = get_unique_teams()
    print(f"Found {len(teams)} unique teams.")
    
    # Load existing if exists
    mapping = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r") as f:
            mapping = json.load(f)
            
    print(f"Loaded {len(mapping)} existing mappings.")
    
    # Filter for missing
    missing = [t for t in teams if t not in mapping]
    print(f"Need to resolve {len(missing)} teams.")
    
    for i, team in enumerate(missing):
        print(f"[{i+1}/{len(missing)}] Searching for '{team}'...", end=" ", flush=True)
        tid = search_team_id(team)
        if tid:
            mapping[team] = tid
            print(f"[OK] Found: {tid}")
        else:
            print("[FAIL] Not Found")
        
        # Rate limit (API-Football Free Tier: 1 call/sec roughly, safer to be slow)
        time.sleep(1.2)
        
        # Autosave every 10
        if i % 10 == 0:
            with open(OUTPUT_FILE, "w") as f:
                json.dump(mapping, f, indent=4)
                
    # Final Save
    with open(OUTPUT_FILE, "w") as f:
        json.dump(mapping, f, indent=4)
        
    print("Done! Mapping saved.")

if __name__ == "__main__":
    main()
