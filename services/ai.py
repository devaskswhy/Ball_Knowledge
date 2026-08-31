"""Gemini-powered narration layer.

Two rules everything here follows:

1. The model never produces a number. Every probability, percentage, or score
   it cites has to come from data we hand it — either baked into the prompt or
   returned by a tool call. The system instruction states this explicitly and
   none of the tools give the model a way to compute anything itself. They
   only return numbers our own models (Elo, Poisson, Monte Carlo) already
   computed.
2. If the data isn't there — an unknown team, an unloaded competition, a cup
   asked for a title race — the tool returns an explicit error string and the
   model is instructed to say so rather than guess.

Runs on Gemini's free tier, so the deployed app costs nothing to operate.
Get a key at https://aistudio.google.com/apikey and set GEMINI_API_KEY.

Nothing here talks to the football data APIs. It only reads from the
LeagueManager that services/api.py already built at startup, via configure().
"""

import json
import os
from datetime import date

from google import genai
from google.genai import types

from services.standings import COMPETITIONS, get_standings_source
from services.simulator import title_race
from services.bracket import bracket

# Overridable so a model rename never requires a code change.
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")

# The free tier is rate limited rather than billed, but a runaway loop is
# still worth a ceiling — same reasoning as the football-data budget in
# services/external_data.py.
DAILY_CALL_LIMIT = 200

# Cap on how many tool calls Gemini may chain in one /ai/ask turn.
MAX_TOOL_CALLS = 6

SYSTEM_PROMPT = """You are the Ball Knowledge match analyst, narrating outputs
from a statistical model (Elo ratings, a Poisson goal model, and Monte Carlo
season simulation) to a football fan.

Hard rule: you must never state, calculate, round, average, or estimate a
number yourself. Every percentage, probability, score, or count you mention
must be copied from the data given to you in this conversation or returned by
a tool call. If you want to discuss a number that isn't in that data, don't —
describe the situation in words instead.

If the information you need was not provided and no tool can supply it (an
unknown team or competition, a competition of the wrong kind, or a question
outside football entirely), say plainly that you don't have that data. Do not
guess, approximate, or fill the gap with general football knowledge presented
as if it came from the model.

Keep the tone like a sharp pre-match column: confident, specific, no hedging
filler, no invented flavour ("the atmosphere will be electric") that isn't
grounded in the data.
"""

_league_manager = None


def configure(league_manager):
    """Give the AI layer access to the loaded competitions. Called once at startup."""
    global _league_manager
    _league_manager = league_manager


_client = None


def _get_client():
    """Lazily build the client so a missing key fails per-request, not at import."""
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


# ---------------------------------------------------------------------------
# Daily call budget
# ---------------------------------------------------------------------------

_budget = {"date": None, "used": 0}


def _roll_day():
    today = date.today().isoformat()
    if _budget["date"] != today:
        _budget["date"] = today
        _budget["used"] = 0


def ai_budget():
    _roll_day()
    return {"date": _budget["date"], "used": _budget["used"], "limit": DAILY_CALL_LIMIT}


def _consume():
    _roll_day()
    if _budget["used"] >= DAILY_CALL_LIMIT:
        raise RuntimeError(
            f"Daily AI call budget exhausted ({DAILY_CALL_LIMIT}/day). Try again tomorrow."
        )
    _budget["used"] += 1


# ---------------------------------------------------------------------------
# Tools — each one is a thin, read-only wrapper around a service that already
# exists. Gemini builds the schema from the type hints and docstring, and
# executes them itself via automatic function calling. None of them let the
# model touch anything it could compute a figure from that we haven't already
# computed ourselves.
# ---------------------------------------------------------------------------

def get_standings(league: str) -> str:
    """Current league table for a competition, computed from real results.

    Args:
        league: Competition code — "PL", "LL", "SA", "L1", "BL", or "UCL".
    """
    source = get_standings_source(league)
    ctx = _league_manager.get_league(league) if _league_manager else None
    if not source or not ctx:
        return json.dumps({"error": f"No data loaded for competition '{league}'"})
    return json.dumps(source(ctx))


def get_title_race(league: str) -> str:
    """Monte Carlo title-race projection for a league. Not valid for cups.

    Args:
        league: League code — "PL", "LL", "SA", "L1", or "BL".
    """
    meta = COMPETITIONS.get(league)
    ctx = _league_manager.get_league(league) if _league_manager else None
    if not meta:
        return json.dumps({"error": f"Unknown competition '{league}'"})
    if meta["kind"] == "cup":
        return json.dumps({"error": f"'{league}' is a knockout competition, not a league — use get_bracket instead"})
    if not ctx:
        return json.dumps({"error": f"No data loaded for competition '{league}'"})
    return json.dumps(title_race(ctx, league))


def predict_match(league: str, home: str, away: str) -> str:
    """Model prediction and expected goals for one specific fixture.

    Args:
        league: Competition code the two teams play in, e.g. "PL".
        home: Home team name, exactly as it appears in get_standings.
        away: Away team name, exactly as it appears in get_standings.
    """
    ctx = _league_manager.get_league(league) if _league_manager else None
    if not ctx:
        return json.dumps({"error": f"No data loaded for competition '{league}'"})

    power_lookup = ctx["power_lookup"]
    if home not in power_lookup or away not in power_lookup:
        return json.dumps({"error": f"Unknown team name in '{league}': '{home}' or '{away}'"})

    res = ctx["predictor"].predict_match(home, away)
    goals = ctx["goal_model"].match_report(home, away)
    return json.dumps({
        "league": league,
        "home": home,
        "away": away,
        "home_win_pct": round(res["home_win"] * 100, 1),
        "draw_pct": round(res["draw"] * 100, 1),
        "away_win_pct": round(res["away_win"] * 100, 1),
        **goals,
    })


def get_bracket(competition: str) -> str:
    """Knockout bracket simulation for a cup competition (currently only UCL).

    Args:
        competition: Cup competition code, e.g. "UCL".
    """
    meta = COMPETITIONS.get(competition)
    ctx = _league_manager.get_league(competition) if _league_manager else None
    if not meta or meta["kind"] != "cup":
        return json.dumps({"error": f"'{competition}' is not a knockout competition"})
    if not ctx:
        return json.dumps({"error": f"No data loaded for competition '{competition}'"})
    return json.dumps(bracket(ctx, competition))


TOOLS = [get_standings, get_title_race, predict_match, get_bracket]


def _competition_name(code):
    return COMPETITIONS.get(code, {}).get("name", code)


def _config(**kwargs):
    return types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, **kwargs)


# ---------------------------------------------------------------------------
# /ai/preview — streamed narration of a single, already-computed prediction
# ---------------------------------------------------------------------------

async def preview_stream(home, away, league, prediction, goals):
    """SSE generator narrating a prediction the caller already computed.

    No tools here — the figures are handed over directly, so there is nothing
    for the model to look up and nothing for it to compute.
    """
    try:
        _consume()
    except RuntimeError as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
        return

    data_block = json.dumps({
        "competition": _competition_name(league),
        "home": home,
        "away": away,
        "home_win_pct": prediction["home_win"],
        "draw_pct": prediction["draw"],
        "away_win_pct": prediction["away_win"],
        **goals,
    }, indent=2)

    user_message = (
        f"Write a short pre-match preview (3-5 sentences) for {home} vs {away} "
        f"in the {_competition_name(league)}.\n\n"
        f"Here is every number you are allowed to use — do not introduce any "
        f"figure that isn't in this data:\n{data_block}"
    )

    try:
        client = _get_client()
        stream = await client.aio.models.generate_content_stream(
            model=MODEL,
            contents=user_message,
            config=_config(max_output_tokens=1024),
        )
        async for chunk in stream:
            if chunk.text:
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"
    except Exception as e:
        # Covers API errors as well as client-side failures like a missing
        # GEMINI_API_KEY, which the SDK raises as a plain ValueError.
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# /ai/title_race — one narration pass over an already-computed simulation
# ---------------------------------------------------------------------------

def narrate_title_race(league, race_data):
    _consume()
    client = _get_client()

    data_block = json.dumps(race_data, indent=2)
    user_message = (
        f"Summarize this Monte Carlo title-race projection for the "
        f"{_competition_name(league)} in 3-4 sentences, for a fan who hasn't "
        f"seen the numbers yet. Every number you mention must come from this "
        f"data:\n{data_block}"
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=user_message,
        config=_config(max_output_tokens=1024),
    )

    text = response.text
    if not text:
        return {"summary": None, "error": "The model returned no text for this projection."}
    return {"summary": text}


# ---------------------------------------------------------------------------
# /ai/ask — free-form Q&A, with Gemini calling the tools itself
# ---------------------------------------------------------------------------

def ask(question):
    """Runs the tool-calling loop and returns the final answer plus a trace of
    which tools were called, so the API response stays inspectable.
    """
    _consume()

    tool_calls = []
    try:
        client = _get_client()
        response = client.models.generate_content(
            model=MODEL,
            contents=question,
            config=_config(
                tools=TOOLS,
                max_output_tokens=4096,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    maximum_remote_calls=MAX_TOOL_CALLS
                ),
            ),
        )
    except Exception as e:
        # Covers API errors as well as client-side failures like a missing
        # GEMINI_API_KEY, which the SDK raises as a plain ValueError.
        return {"answer": None, "error": str(e), "tool_calls": tool_calls}

    for entry in response.automatic_function_calling_history or []:
        for part in getattr(entry, "parts", None) or []:
            call = getattr(part, "function_call", None)
            if call:
                tool_calls.append({"tool": call.name, "input": dict(call.args or {})})

    text = response.text
    if not text:
        return {
            "answer": "I can't answer that one.",
            "refused": True,
            "tool_calls": tool_calls,
        }

    return {"answer": text, "tool_calls": tool_calls}
