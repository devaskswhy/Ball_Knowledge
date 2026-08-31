"""Refresh the league CSVs from football-data.co.uk.

Free, no API key, no request limit — football-data.co.uk publishes one CSV per
league per season and updates it within a day or two of each round.

    python scripts/refresh_data.py              # current + previous season
    python scripts/refresh_data.py --check      # report what is on disk
    python scripts/refresh_data.py --season 2627

Files land in data/<season>/<code>.csv. If the download is blocked on your
network the script prints the exact URLs so you can fetch them in a browser and
drop them in the same place.
"""

import argparse
import sys
from datetime import date
from pathlib import Path

import pandas as pd

BASE_URL = "https://www.football-data.co.uk/mmz4281"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# football-data.co.uk division codes for the leagues we cover.
LEAGUE_CODES = {
    "E0": "Premier League",
    "SP1": "La Liga",
    "I1": "Serie A",
    "F1": "Ligue 1",
    "D1": "Bundesliga",
}


def current_season(today=None):
    """Season code for a date — '2627' for 2026/27.

    A European season starts in July, so anything from July onward belongs to
    the season named for that year.
    """
    today = today or date.today()
    start = today.year if today.month >= 7 else today.year - 1
    return f"{str(start)[2:]}{str(start + 1)[2:]}"


def previous_season(season):
    start = 2000 + int(season[:2])
    return f"{str(start - 1)[2:]}{str(start)[2:]}"


def season_label(season):
    return f"20{season[:2]}/{season[2:]}"


def url_for(season, code):
    return f"{BASE_URL}/{season}/{code}.csv"


def describe(path):
    """Match count and date range of a CSV already on disk."""
    try:
        df = pd.read_csv(path, encoding="latin1")
        df["Date"] = pd.to_datetime(df["Date"], dayfirst=True, format="mixed", errors="coerce")
        df = df.dropna(subset=["Date"])
        if df.empty:
            return "no dated rows"
        return (
            f"{len(df):>4} matches  {df['Date'].min().date()} -> {df['Date'].max().date()}"
        )
    except Exception as e:
        return f"unreadable ({type(e).__name__})"


def download(season, code, timeout=30):
    """Fetch one CSV. Returns (text, None) or (None, reason)."""
    import httpx

    url = url_for(season, code)
    try:
        r = httpx.get(url, timeout=timeout, follow_redirects=True)
    except Exception as e:
        return None, f"{type(e).__name__}: {str(e)[:110]}"

    if r.status_code != 200:
        return None, f"HTTP {r.status_code}"
    if "html" in r.headers.get("content-type", "").lower():
        return None, "server returned HTML, not CSV (blocked or moved)"
    if "Date" not in r.text[:400]:
        return None, "response does not look like a football-data CSV"
    return r.text, None


def refresh(seasons):
    failures = []
    for season in seasons:
        print(f"\n{season_label(season)}")
        target_dir = DATA_DIR / season
        target_dir.mkdir(parents=True, exist_ok=True)

        for code, name in LEAGUE_CODES.items():
            text, error = download(season, code)
            if error:
                print(f"  [FAIL] {name:<16} {error}")
                failures.append((season, code))
                continue

            path = target_dir / f"{code}.csv"
            path.write_text(text, encoding="latin1", errors="replace")
            print(f"  [ OK ] {name:<16} {describe(path)}")

    return failures


def check(seasons):
    for season in seasons:
        target_dir = DATA_DIR / season
        print(f"\n{season_label(season)}  ({target_dir})")
        if not target_dir.is_dir():
            print("  not present")
            continue
        for code, name in LEAGUE_CODES.items():
            path = target_dir / f"{code}.csv"
            print(f"  {name:<16} {describe(path) if path.exists() else 'missing'}")

    legacy = [DATA_DIR / f"{c}.csv" for c in LEAGUE_CODES]
    if any(p.exists() for p in legacy):
        print(f"\nlegacy flat files ({DATA_DIR})")
        for code, name in LEAGUE_CODES.items():
            path = DATA_DIR / f"{code}.csv"
            if path.exists():
                print(f"  {name:<16} {describe(path)}")


def print_manual_instructions(failures):
    print("\n" + "=" * 72)
    print("Download blocked. Fetch these in a browser and save them as shown:")
    print("=" * 72)
    for season, code in failures:
        print(f"  {url_for(season, code)}")
        print(f"      -> data/{season}/{code}.csv")
    print("\nThen run:  python scripts/refresh_data.py --check")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", help="season code, e.g. 2627. Defaults to current + previous.")
    parser.add_argument("--check", action="store_true", help="report what is on disk, download nothing")
    args = parser.parse_args()

    if args.season:
        seasons = [args.season]
    else:
        now = current_season()
        seasons = [previous_season(now), now]

    if args.check:
        check(seasons)
        return 0

    print(f"Refreshing {', '.join(season_label(s) for s in seasons)} into {DATA_DIR}")
    failures = refresh(seasons)

    if failures:
        print_manual_instructions(failures)
        return 1

    print("\nAll files refreshed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
