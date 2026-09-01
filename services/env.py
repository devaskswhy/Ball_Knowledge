"""Deterministic environment loading.

python-dotenv's bare `load_dotenv()` resolves its file by walking up from the
*calling module's* directory, so every module under services/ found
services/.env and silently ignored the .env at the repo root. Keys placed in
the root file (the one .env.example describes) never reached the app when it
ran under uvicorn, while the same import worked from a shell at the root -
which made it look environment-specific rather than order-specific.

Loading both files by absolute path removes the ambiguity. The root file is
loaded first and wins, since that is the one the README and .env.example
point people at; services/.env is kept as a fallback for existing setups.
Neither overrides variables already set by the host, so Render's dashboard
values still take precedence in production.
"""

from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_env():
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / "services" / ".env")


load_env()
