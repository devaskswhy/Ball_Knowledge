import os
import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("API_FOOTBALL_KEY")

HEADERS = {
    "x-apisports-key": API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io"
}
BASE_URL = "https://v3.football.api-sports.io"

def get_injuries(team_id, season=2024):
    if not API_KEY:
        print("Warning: No API Key found.")
        return []
        
    url = f"{BASE_URL}/injuries"
    params = {"team": team_id, "season": season}

    try:
        r = requests.get(url, headers=HEADERS, params=params)
        data = r.json().get("response", [])
    except Exception as e:
        print(f"Error fetching injuries for {team_id}: {e}")
        return []

    injuries = []
    for i in data:
        fi = i["player"]
        pos_map = {
            "Goalkeeper": "GK",
            "Defender": "DEF",
            "Midfielder": "MID",
            "Attacker": "ATT"
        }
        
        position = pos_map.get(fi["type"], "MID")
        
        # Deduplicate by checking if name already exists
        if any(inj["name"] == fi["name"] for inj in injuries):
            continue

        injuries.append({
            "name": fi["name"],
            "position": position,
            "impact": 5 # Default impact, user adjusts manually
        })
    
    return injuries[:8] # Limit to 8 to avoid clutter

def get_last_match_date(team_id, season=2024):
    if not API_KEY:
        return None

    url = f"{BASE_URL}/fixtures"
    # Fetch last 1 match that is finished
    params = {
        "team": team_id, 
        "last": 1, 
        "status": "FT",
        "season": season
    }

    try:
        r = requests.get(url, headers=HEADERS, params=params)
        data = r.json().get("response", [])
        if data:
            # Format: 2024-04-20T14:00:00+00:00
            return data[0]["fixture"]["date"]
    except Exception as e:
        print(f"Error fetching fixtures for {team_id}: {e}")
        return None

def role_counts(injuries):
    roles = {"GK": 0, "DEF": 0, "MID": 0, "ATT": 0}
    for p in injuries:
        if p["position"] in roles:
            roles[p["position"]] += 1
    return roles

def search_team_id(team_name):
    if not API_KEY: 
        return None
    
    url = f"{BASE_URL}/teams"
    params = {"search": team_name}
    
    try:
        r = requests.get(url, headers=HEADERS, params=params)
        data = r.json().get("response", [])
        if data:
            return data[0]["team"]["id"]
    except Exception as e:
        print(f"Search error for {team_name}: {e}")
    return None

def get_lineup(team_id, season=2024):
    if not API_KEY:
        return []

    # 1. Get last match (proxy for current form/lineup)
    url_fixtures = f"{BASE_URL}/fixtures"
    params_fixtures = {
        "team": team_id,
        "last": 1,
        "season": season
    }
    
    try:
        r = requests.get(url_fixtures, headers=HEADERS, params=params_fixtures)
        data = r.json().get("response", [])
        if not data:
            return []
        
        fixture_id = data[0]["fixture"]["id"]
        
        # 2. Get Lineup for that fixture
        url_lineup = f"{BASE_URL}/fixtures/lineups"
        params_lineup = {"fixture": fixture_id, "team": team_id}
        
        r_l = requests.get(url_lineup, headers=HEADERS, params=params_lineup)
        data_l = r_l.json().get("response", [])
        
        if not data_l:
            return []

        # Parse startXI
        lineup_raw = data_l[0]["startXI"]
        lineup = []
        for p in lineup_raw:
             # Map 'G', 'D', 'M', 'F' to our format if needed, or keep as is
             # Player dict: {player: {id, name, number, pos, grid}}
             player_obj = p["player"]
             lineup.append({
                 "id": str(player_obj["id"]),
                 "name": player_obj["name"],
                 "number": player_obj["number"],
                 "pos": player_obj["pos"] # usually "G", "D", "M", "F"
             })
             
        return lineup

    except Exception as e:
        print(f"Lineup fetch error for {team_id}: {e}")
        return []