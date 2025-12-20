import numpy as np

class MatchPredictor:
    def __init__(self, elo_engine, power_lookup):
        self.elo_engine = elo_engine
        self.power_lookup = power_lookup

    def predict_match(self, home, away):
        elo_home = self.elo_engine.get_elo(home)
        elo_away = self.elo_engine.get_elo(away)
        elo_diff = elo_home - elo_away

        prob_home_elo = 1 / (1 + 10 ** (-elo_diff / 400))

        ps_home = self.power_lookup.get(home, 50)
        ps_away = self.power_lookup.get(away, 50)
        ps_diff = ps_home - ps_away

        prob_home_power = 1 / (1 + np.exp(-ps_diff / 12))

        final_home = 0.55 * prob_home_elo + 0.45 * prob_home_power
        final_away = 1 - final_home

        base_draw = 0.22
        total = final_home + final_away + base_draw

        return {
            "home": home,
            "away": away,
            "home_win": final_home / total,
            "draw": base_draw / total,
            "away_win": final_away / total,
            "elo_diff": elo_diff,
            "power_diff": ps_diff
        }
