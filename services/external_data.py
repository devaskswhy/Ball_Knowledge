import requests

API_KEY = "YOUR_API_KEY"

def get_injuries(team_id):
    url = "https://v3.football.api-sports.io/injuries"
    headers = {"x-apisports-key": API_KEY}
    params = {"team": team_id, "season": 2024}

    r = requests.get(url, headers=headers, params=params)
    data = r.json()["response"]

    injuries = []
    for i in data:
        injuries.append({
            "player": i["player"]["name"],
            "position": i["player"]["type"]  # GK/DEF/MID/ATT
        })
    return injuries
def role_counts(injuries):
    roles = {"GK": 0, "DEF": 0, "MID": 0, "ATT": 0}
    for p in injuries:
        if p["position"] in roles:
            roles[p["position"]] += 1
    return roles