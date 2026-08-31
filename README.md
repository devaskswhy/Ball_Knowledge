# Ball Knowledge

Football match-outcome prediction across the big-5 leagues and the Champions
League: current tables, a Monte Carlo title race, a knockout bracket
simulation, and per-match predictions with injury and rest-day adjustments —
all backed by real results, never placeholder data, and narrated by Claude
when asked.

## How it works

- **Elo ratings**, carried across seasons with regression to the mean at
  each boundary and a penalty for newly promoted clubs (`models/elo_engine.py`,
  `services/league_manager.py`).
- **A Poisson goal model**, calibrated per league against that league's own
  observed draw rate, shared by the match predictor and the `/predict` route
  so the two can never disagree (`models/poisson.py`).
- **Monte Carlo simulation** — 10,000 runs of the season's remaining
  fixtures for the title race, and 10,000 simulated knockout brackets for the
  Champions League, resolved with a closed-form two-legged win probability
  instead of an inner simulation loop (`services/simulator.py`,
  `services/bracket.py`).
- **Claude** narrates the numbers above on request — it never computes or
  invents a figure itself, only relays ones already produced by the model,
  and says so plainly when it doesn't have the data (`services/ai.py`).

Standings for the five leagues come from football-data.co.uk CSVs checked
into `data/`, refreshed with `scripts/refresh_data.py`. The Champions League
is a one-time committed snapshot (`data/ucl_2024.json`) — the free
API-Football plan only serves 2022–2024, and the 2024/25 season is already
finished, so there's nothing to refresh.

## Project layout

```
services/        FastAPI app, data loading, standings/simulation/AI logic
models/          Elo engine, Poisson goal model, match predictor
scripts/         One-off data refresh and snapshot scripts
data/            Season CSVs + the UCL snapshot
alembic/         Database migrations
frontend_ui/     Next.js app (App Router)
```

Frontend routes:

| Route | Purpose |
|---|---|
| `/` | Competition picker + live fixtures/top-players widget |
| `/[competition]` | Table, and title race (leagues) or bracket (UCL) |
| `/[competition]/predict` | Match predictor, injuries, lineups, AI preview |
| `/[competition]/ask` | Free-form Q&A over the model via Claude tool use |

## Local development

### Backend

```bash
pip install -r requirements.txt
cp .env.example .env   # fill in API_SPORTS_KEY and ANTHROPIC_API_KEY
python -m alembic upgrade head
python -m uvicorn services.api:app --reload --port 8000
```

Without `DATABASE_URL` set, this uses a SQLite file at the repo root — no
Postgres needed for local dev.

### Frontend

```bash
cd frontend_ui
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

> If port 8000 is already in use by something else on your machine, run the
> backend on a different port and update `NEXT_PUBLIC_API_URL` to match —
> `localhost` can resolve to a different service than you expect if
> something else is bound to the same port on a different IP stack (IPv4 vs
> IPv6). Prefer `127.0.0.1` over `localhost` if you hit this.

### Refreshing data

```bash
python scripts/refresh_data.py --check   # reports what's missing
python scripts/refresh_data.py           # downloads current + previous season
```

football-data.co.uk is sometimes blocked by network content filters (it
carries betting odds columns). If downloads fail, the script prints the
exact URLs so you can fetch them manually and drop the CSVs into
`data/<season>/`.

## Environment variables

See `.env.example` for the backend. In short:

| Variable | Required | Notes |
|---|---|---|
| `API_SPORTS_KEY` (or `API_FOOTBALL_KEY`) | Yes | Free plan: 100 requests/day, capped in-app at 90 |
| `ANTHROPIC_API_KEY` | For `/ai/*` routes | Everything else works without it |
| `DATABASE_URL` | No | Defaults to local SQLite; set for Postgres in production |

Frontend: `NEXT_PUBLIC_API_URL`, pointing at the backend's base URL.

## Deployment

Backend on **Render**, frontend on **Vercel**.

### Backend (Render)

This repo includes `render.yaml`, a blueprint that provisions a free
Postgres database and a web service wired together, running
`alembic upgrade head` on every deploy before starting the app.

1. Push this repo to GitHub (already done if you're reading this from there).
2. In the Render dashboard: **New > Blueprint**, point it at this repo.
   Render reads `render.yaml` and creates both resources.
3. Once created, open the web service's **Environment** tab and set:
   - `API_SPORTS_KEY` — your API-Football key
   - `ANTHROPIC_API_KEY` — your Claude API key
   (`DATABASE_URL` is wired automatically from the Postgres instance.)
4. Deploy. Check `https://<your-service>.onrender.com/health` — it reports
   `leagues_loaded`, the API budget, and the AI budget.

### Frontend (Vercel)

1. **New Project** in Vercel, import this repo.
2. Set **Root Directory** to `frontend_ui` (this is a monorepo — the Next.js
   app isn't at the repo root).
3. Add an environment variable: `NEXT_PUBLIC_API_URL` = your Render service's
   URL (e.g. `https://ball-knowledge-api.onrender.com`).
4. Deploy.

### Post-deploy checklist

- `GET /health` on the backend shows all 6 competitions in `leagues_loaded`.
- `GET /standings?league=PL` returns a real table, not an empty one.
- A prediction from the deployed frontend succeeds and doesn't 500 (this is
  what the `predictions.match_id` migration exists to prevent on a fresh
  database — see `alembic/versions/166708d88600_predictions_match_id_nullable.py`).
- Render's free Postgres and free web service both spin down on inactivity;
  the first request after idling will be slow while they wake up.

## Known limitations

- The free API-Football plan only serves seasons 2022–2024, so live
  standings and title races are computed locally from CSVs rather than
  fetched — see the module docstring in `services/standings.py`.
- Data currency depends on `scripts/refresh_data.py` being run each
  matchday; nothing here auto-refreshes the CSVs.
- CORS is wide open (`allow_origins=["*"]`) since this is a public,
  read-mostly demo with no authentication. Lock it down in
  `services/api.py` if that ever changes.
