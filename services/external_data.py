import os
import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("API_FOOTBALL_KEY")
if not API_KEY:
    raise RuntimeError("API_FOOTBALL_KEY is not set. Add it to your .env file.")

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
            "id": str(hash(fi["name"])), # Unique ID based on name
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

def get_squad(team_id):
    """Fetch full squad roster with player photos and details"""
    if not API_KEY:
        return []
    
    url = f"{BASE_URL}/players/squads"
    params = {"team": team_id}
    
    try:
        r = requests.get(url, headers=HEADERS, params=params)
        data = r.json().get("response", [])
        
        if not data:
            return []
        
        players = data[0].get("players", [])
        squad = []
        
        for p in players:
            # Map position to short format
            pos_map = {
                "Goalkeeper": "GK",
                "Defender": "DEF", 
                "Midfielder": "MID",
                "Attacker": "ATT"
            }
            position = pos_map.get(p.get("position"), "MID")
            
            # Generate a rating (API doesn't provide, estimate based on age)
            age = p.get("age", 25)
            base_rating = 75
            if age < 23:
                rating = base_rating + (age - 18)  # Young talent: 75-80
            elif age < 30:
                rating = base_rating + 5 + (30 - age) // 2  # Prime: 78-85
            else:
                rating = base_rating + 3 - (age - 30)  # Veteran: 75-78
            rating = max(65, min(95, rating))  # Clamp
            
            squad.append({
                "id": p.get("id"),
                "name": p.get("name"),
                "age": p.get("age"),
                "number": p.get("number"),
                "position": position,
                "photo": p.get("photo"),
                "rating": rating
            })
        
        return squad
        
    except Exception as e:
        print(f"Squad fetch error for {team_id}: {e}")
        return []


def get_featured_fixtures():
    """Get today's top fixtures from top 5 leagues"""
    if not API_KEY:
        return []
    
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Top 5 league IDs: PL=39, La Liga=140, Serie A=135, Bundesliga=78, Ligue 1=61
    top_leagues = [39, 140, 135, 78, 61]
    
    try:
        url = f"{BASE_URL}/fixtures"
        params = {"date": today}
        r = requests.get(url, headers=HEADERS, params=params)
        data = r.json().get("response", [])
        
        featured = []
        for match in data:
            league_id = match.get("league", {}).get("id")
            if league_id in top_leagues:
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
                    }
                })
        
        return featured[:5]  # Return top 5 matches
        
    except Exception as e:
        print(f"Featured fixtures error: {e}")
        return []


def get_top_players(season=2024):
    """Get top impact players across all major leagues based on rating and performance"""
    if not API_KEY:
        return []
    
    # Top 5 league IDs: PL=39, La Liga=140, Serie A=135, Bundesliga=78, Ligue 1=61
    top_leagues = [39, 140, 135, 78, 61]
    all_players = []
    
    try:
        url = f"{BASE_URL}/players/topscorers"
        
        for league_id in top_leagues:
            params = {"league": league_id, "season": season}
            r = requests.get(url, headers=HEADERS, params=params)
            data = r.json().get("response", [])
            
            for p in data[:3]:  # Top 3 from each league
                player = p.get("player", {})
                stats = p.get("statistics", [{}])[0]
                
                # Format rating to 1 decimal place
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
                    "goals": stats.get("goals", {}).get("total", 0),
                    "assists": stats.get("goals", {}).get("assists", 0),
                    "rating": formatted_rating,
                })
        
        print(f"Fetched {len(all_players)} players total from all leagues")
        
        # Sort by rating (primary), goals (secondary), assists (tertiary) - for impact players
        def sort_key(p):
            rating_val = float(p["rating"] or 0)
            return (rating_val, p["goals"], p["assists"])
        
        all_players.sort(key=sort_key, reverse=True)
        
        # Return top 5 players overall
        return all_players[:5]
        
    except Exception as e:
        print(f"Top players error: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_team_colors(team_id):
    """Get team primary and secondary colors"""
    if not API_KEY:
        return {"primary": "#6366f1", "secondary": "#22d3ee"}
    
    try:
        url = f"{BASE_URL}/teams"
        params = {"id": team_id}
        r = requests.get(url, headers=HEADERS, params=params)
        data = r.json().get("response", [])
        
        if data:
            team = data[0].get("team", {})
            # API doesn't provide colors directly, so we'll use logo color extraction or defaults
            # For now return based on team name patterns
            return {
                "primary": "#6366f1",  # Default indigo
                "secondary": "#22d3ee",  # Default cyan
                "logo": team.get("logo")
            }
        
        return {"primary": "#6366f1", "secondary": "#22d3ee"}
        
    except Exception as e:
        return {"primary": "#6366f1", "secondary": "#22d3ee"}
        
    except Exception as e:
        print(f"Team colors error: {e}")
        return {"primary": "#6366f1", "secondary": "#22d3ee"}

def get_player_stats(player_id, season=2024, league_id=39):
    """Fetch detailed season stats for a player"""
    if not API_KEY:
        return None
        
    url = f"{BASE_URL}/players"
    params = {
        "id": player_id,
        "season": season,
        "league": league_id
    }
    
    try:
        r = requests.get(url, headers=HEADERS, params=params)
        data = r.json().get("response", [])
        
        if not data:
            return None
            
        # Data structure: response[0] -> { player: {...}, statistics: [{...}] }
        player_data = data[0]
        stats = player_data["statistics"][0]
        
        return {
            "player": player_data["player"],
            "statistics": stats
        }
        
    except Exception as e:
        print(f"Player stats error for {player_id}: {e}")
        return None