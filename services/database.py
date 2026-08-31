import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Default to a SQLite file next to the repo root so the database does not
# depend on the directory uvicorn happens to be launched from.
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = REPO_ROOT / "ballknowledge.db"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}")

# Some hosts (Heroku-style) still hand back the deprecated "postgres://"
# scheme; SQLAlchemy 1.4+ only recognizes "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


def init_db():
    """Create any tables that do not exist yet.

    Alembic still owns migrations; this only guarantees a usable schema on a
    fresh checkout or an empty database.
    """
    from services import models  # noqa: F401  (registers the mappers on Base)

    Base.metadata.create_all(bind=engine)
    return sorted(Base.metadata.tables.keys())


# Dependency for FastAPI
def get_db():
    """FastAPI dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
