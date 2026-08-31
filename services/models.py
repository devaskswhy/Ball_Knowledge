from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from services.database import Base


def utcnow():
    """Timezone-aware UTC timestamp for column defaults."""
    return datetime.now(timezone.utc)

class Match(Base):
    """Match model for storing match information and prediction tracking"""
    __tablename__ = "matches"
    
    id = Column(Integer, primary_key=True, index=True)
    home_team = Column(String, nullable=False, index=True)
    away_team = Column(String, nullable=False, index=True)
    league = Column(String, nullable=False, index=True)
    date = Column(DateTime, nullable=False)
    home_goals = Column(Integer, nullable=True)
    away_goals = Column(Integer, nullable=True)
    home_prob = Column(Float, nullable=True)  # Predicted home win probability
    draw_prob = Column(Float, nullable=True)  # Predicted draw probability
    away_prob = Column(Float, nullable=True)  # Predicted away win probability
    created_at = Column(DateTime(timezone=True), default=utcnow)
    
    # Relationship to predictions
    predictions = relationship("Prediction", back_populates="match")

class Prediction(Base):
    """Prediction model for storing prediction history"""
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=True)
    home_win_prob = Column(Float, nullable=False)
    draw_prob = Column(Float, nullable=False)
    away_win_prob = Column(Float, nullable=False)
    predicted_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    actual_outcome = Column(String, nullable=True)  # "home", "draw", "away", or None if not played yet
    model_version = Column(String, default="v1.0", nullable=False)
    elo_diff = Column(Float, nullable=True)
    power_diff = Column(Float, nullable=True)
    
    # Relationship to match
    match = relationship("Match", back_populates="predictions")

class Team(Base):
    """Team model for storing team metadata"""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    league = Column(String, nullable=False, index=True)
    api_football_id = Column(Integer, unique=True, nullable=True)
    elo_rating = Column(Float, default=1500.0, nullable=True)
    power_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class Player(Base):
    """Player model for storing player metadata"""
    __tablename__ = "players"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    position = Column(String, nullable=True)  # GK, DEF, MID, ATT
    api_football_id = Column(Integer, unique=True, nullable=True)
    age = Column(Integer, nullable=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
