# models/preview.py

def get_team_summary_from_tables(team_name, power_table, team_features):
    # power_table: DataFrame with ['team','power_score','elo',...]
    # team_features: DataFrame with gf_last10, ga_last10, pts_last5
    row_power = power_table[power_table['team'] == team_name].iloc[0]
    row_feat = team_features[team_features['team'] == team_name].iloc[0]
    return {
        "team": team_name,
        "power_score": float(row_power['power_score']),
        "elo": float(row_power['elo']),
        "gf_last10": float(row_feat['gf_last10']),
        "ga_last10": float(row_feat['ga_last10']),
        "pts_last5": float(row_feat['pts_last5']),
    }

def generate_match_preview(home, away, predictor, power_table, team_features):
    """
    Returns a human-friendly preview string using the predictor (no external LLM).
    predictor: instance of MatchPredictor
    power_table & team_features: DataFrames (as used in your notebook)
    """
    pred = predictor.predict_match(home, away)
    home_stats = get_team_summary_from_tables(home, power_table, team_features)
    away_stats = get_team_summary_from_tables(away, power_table, team_features)

    home_prob = pred['home_win'] * 100
    draw_prob = pred['draw'] * 100
    away_prob = pred['away_win'] * 100

    parts = []
    parts.append(f"{home} host {away}.")
    parts.append(
        f"{home} have a Power Score of {home_stats['power_score']:.1f} (Elo {home_stats['elo']:.0f}), "
        f"while {away} sit at {away_stats['power_score']:.1f} (Elo {away_stats['elo']:.0f})."
    )
    parts.append(
        f"Last 10: {home} {home_stats['gf_last10']:.1f}/{home_stats['ga_last10']:.1f} vs "
        f"{away} {away_stats['gf_last10']:.1f}/{away_stats['ga_last10']:.1f}."
    )
    parts.append(
        f"Our model: {home} {home_prob:.1f}% — Draw {draw_prob:.1f}% — {away} {away_prob:.1f}%."
    )

    if home_prob - away_prob > 20:
        parts.append(f"{home} are clear favourites; expect them to dominate possession and chances.")
    elif away_prob - home_prob > 20:
        parts.append(f"{away} are the clear favourites and should exploit {home}'s defensive weaknesses.")
    else:
        parts.append("Looks competitive — moments and finishing will decide.")

    return "\n".join(parts)
