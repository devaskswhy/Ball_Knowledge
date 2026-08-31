"""Goal expectations, scorelines, and the draw probability.

One GoalModel per league, built once at load time and shared by
MatchPredictor and the /predict route — so the draw probability the model
publishes and the scoreline it publishes can never drift apart.

Attack and defence come from each side's last-10 scoring and conceding rate
relative to the league; the baselines are that league's own home and away
scoring averages.
"""

import numpy as np

MAX_GOALS = 8

# One power-score point of injury or fatigue damage costs this much scoring
# rate. 10 points (a heavy injury list on short rest) costs about 18%.
POWER_TO_GOALS = 0.02

# Independent Poisson under-predicts draws — real matches cluster on 0-0 and
# 1-1 more than independence implies. Rather than hard-code a correction, each
# league calibrates against its own observed draw rate at construction, inside
# these bounds.
DRAW_BOUNDS = (0.06, 0.40)
CALIBRATION_BOUNDS = (0.5, 2.5)


def _pmf(lam, k_max=MAX_GOALS):
    """P(X = 0..k_max) for a Poisson with mean `lam`."""
    k = np.arange(k_max + 1)
    log_factorial = np.cumsum(np.concatenate(([0.0], np.log(np.arange(1, k_max + 1)))))
    return np.exp(-lam + k * np.log(max(lam, 1e-9)) - log_factorial)


class GoalModel:
    """Per-league goal expectations, calibrated to that league's draw rate."""

    def __init__(self, df, final_stats):
        self.home_avg = float(df["home_goals"].mean())
        self.away_avg = float(df["away_goals"].mean())

        stats = final_stats.set_index("team")
        self.gf = stats["gf_last10"].to_dict()
        self.ga = stats["ga_last10"].to_dict()
        self.league_gf = float(stats["gf_last10"].mean()) or 1.0
        self.league_ga = float(stats["ga_last10"].mean()) or 1.0

        self.observed_draw_rate = float((df["home_goals"] == df["away_goals"]).mean())
        self.draw_calibration = self._calibrate(df)

    # -- calibration ------------------------------------------------------

    def _calibrate(self, df):
        """Scale raw Poisson draws so the league's average matches reality.

        Averaged over every match actually played, the calibrated draw
        probability equals the league's observed draw rate by construction.
        """
        raw = np.array([
            self._raw_draw_probability(home, away)
            for home, away in zip(df["home"], df["away"])
        ])
        mean_raw = float(raw.mean()) if raw.size else 0.0
        if mean_raw <= 0:
            return 1.0
        return float(np.clip(self.observed_draw_rate / mean_raw, *CALIBRATION_BOUNDS))

    # -- goal expectations -------------------------------------------------

    def _strength(self, team, table, league_mean):
        value = table.get(team)
        if value is None:
            return 1.0
        return max(float(value) / league_mean, 0.15)

    def expected_goals(self, home, away, home_power_loss=0.0, away_power_loss=0.0):
        """Expected goals for each side."""
        lam_home = (
            self.home_avg
            * self._strength(home, self.gf, self.league_gf)
            * self._strength(away, self.ga, self.league_ga)
        )
        lam_away = (
            self.away_avg
            * self._strength(away, self.gf, self.league_gf)
            * self._strength(home, self.ga, self.league_ga)
        )

        # Injuries and fatigue suppress the affected side's scoring.
        lam_home *= float(np.exp(-POWER_TO_GOALS * max(home_power_loss, 0.0)))
        lam_away *= float(np.exp(-POWER_TO_GOALS * max(away_power_loss, 0.0)))

        return float(np.clip(lam_home, 0.15, 6.0)), float(np.clip(lam_away, 0.15, 6.0))

    # -- draw probability --------------------------------------------------

    def _raw_draw_probability(self, home, away, home_power_loss=0.0, away_power_loss=0.0):
        """Uncalibrated P(draw) — the diagonal of the scoreline grid."""
        lam_home, lam_away = self.expected_goals(home, away, home_power_loss, away_power_loss)
        ph, pa = _pmf(lam_home), _pmf(lam_away)
        return float((ph * pa).sum() / (ph.sum() * pa.sum()))

    def draw_probability(self, home, away, home_power_loss=0.0, away_power_loss=0.0):
        """Calibrated P(draw) for this fixture."""
        raw = self._raw_draw_probability(home, away, home_power_loss, away_power_loss)
        return float(np.clip(raw * self.draw_calibration, *DRAW_BOUNDS))

    # -- full report -------------------------------------------------------

    def match_report(self, home, away, home_power_loss=0.0, away_power_loss=0.0):
        """Expected goals, likely scorelines, and the outcome split they imply."""
        lam_home, lam_away = self.expected_goals(home, away, home_power_loss, away_power_loss)
        grid = np.outer(_pmf(lam_home), _pmf(lam_away))
        grid = grid / grid.sum()

        top_home, top_away = np.unravel_index(int(np.argmax(grid)), grid.shape)

        alternatives = [
            {"score": f"{int(h)}-{int(a)}", "probability": round(float(grid[h, a]) * 100, 1)}
            for h, a in (
                np.unravel_index(i, grid.shape)
                for i in np.argsort(grid, axis=None)[::-1][:3]
            )
        ]

        return {
            "expected_goals": {
                "home": round(lam_home, 2),
                "away": round(lam_away, 2),
                "total": round(lam_home + lam_away, 2),
            },
            "likely_scoreline": f"{int(top_home)}-{int(top_away)}",
            "scoreline_probability": round(float(grid[top_home, top_away]) * 100, 1),
            "alternative_scorelines": alternatives,
            "poisson_check": {
                "home_win": round(float(np.tril(grid, -1).sum()) * 100, 1),
                "draw": round(float(np.trace(grid)) * 100, 1),
                "away_win": round(float(np.triu(grid, 1).sum()) * 100, 1),
            },
        }
