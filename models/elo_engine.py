import pandas as pd
import numpy as np

class EloEngine:
    def __init__(self, base_elo=1500, k=20):
        self.base_elo = base_elo
        self.k = k
        self.team_elos = {}

    def get_elo(self, team):
        if team not in self.team_elos:
            self.team_elos[team] = self.base_elo
        return self.team_elos[team]

    def expected_result(self, elo_a, elo_b):
        return 1 / (1 + 10 ** ((elo_b - elo_a) / 400))

    def update(self, home, away, home_goals, away_goals):
        elo_home = self.get_elo(home)
        elo_away = self.get_elo(away)

        # Match result scoring
        if home_goals > away_goals:
            score_home, score_away = 1, 0
        elif away_goals > home_goals:
            score_home, score_away = 0, 1
        else:
            score_home, score_away = 0.5, 0.5

        expected_home = self.expected_result(elo_home, elo_away)
        expected_away = 1 - expected_home

        # Update Elo
        new_elo_home = elo_home + self.k * (score_home - expected_home)
        new_elo_away = elo_away + self.k * (score_away - expected_away)

        self.team_elos[home] = new_elo_home
        self.team_elos[away] = new_elo_away
    def compute_season(self, df):
        for _, row in df.iterrows():
            self.update(
                row["home"],
                row["away"],
                row["home_goals"],
                row["away_goals"]
            )
        return self.team_elos
