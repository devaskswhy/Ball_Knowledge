import numpy as np

class MatchPredictor:
    def __init__(self, elo_engine, power_lookup):
        self.elo_engine = elo_engine
        self.power_lookup = power_lookup

    def predict_match(self, home, away, home_injuries=None, away_injuries=None, home_rest=7, away_rest=7):
        elo_home = self.elo_engine.get_elo(home)
        elo_away = self.elo_engine.get_elo(away)
        elo_diff = elo_home - elo_away

        prob_home_elo = 1 / (1 + 10 ** (-elo_diff / 400))

        ps_home = self.power_lookup.get(home, 50)
        ps_away = self.power_lookup.get(away, 50)

        # Apply Injury Penalties
        def calculate_penalty(injuries):
            if not injuries:
                return 0
            penalty = 0
            for inj in injuries:
                impact = inj.get("impact", 0) # 1-10
                # Weighting: 10 impact = 5 power score drop
                penalty += (impact * 0.5)
            return penalty

        home_penalty = calculate_penalty(home_injuries)
        away_penalty = calculate_penalty(away_injuries)

        ps_home -= home_penalty
        ps_away -= away_penalty

        # Apply Fatigue / Context
        # Rest Days < 3: High Fatigue (-4)
        # Rest Days = 3: Med Fatigue (-2)
        # Rest Days > 7: Freshness (+2)
        def calculate_fatigue(rest_days):
            if rest_days < 3:
                return 4.0
            elif rest_days == 3:
                return 2.0
            elif rest_days > 7:
                return -2.0 # Negative penalty = Bonus
            return 0.0

        home_fatigue = calculate_fatigue(home_rest)
        away_fatigue = calculate_fatigue(away_rest)

        ps_home -= home_fatigue
        ps_away -= away_fatigue

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
            "power_diff": ps_diff,
            "home_penalty": home_penalty,
            "away_penalty": away_penalty,
            "home_fatigue": home_fatigue,
            "away_fatigue": away_fatigue
        }
