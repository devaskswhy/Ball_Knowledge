"""Claude-powered narration layer.

Two rules everything here follows:

1. Claude never produces a number. Every probability, percentage, or score it
   cites has to come from data we hand it directly in the prompt or from a
   tool call it makes — the system prompt states this as a hard rule, and
   none of the tools give the model a way to compute anything itself. They
   only return numbers our own models (Elo, Poisson, Monte Carlo) already
   computed.
2. If the data isn't there — an unknown team, an unloaded competition, a cup
   asked for a title race — the tool returns an explicit error string and the
   model is instructed to say so plainly rather than guess.

Nothing here talks to the football data APIs. It only reads from the
LeagueManager that services/api.py already built at startup, via configure().
"""

import json
import time
from datetime import date, timezone

import anthropic
from anthropic import beta_tool

from services.standings import COMPETITIONS, get_standings_source
from services.simulator import title_race
from services.bracket import bracket

MODEL = "claude-opus-5"

# A demo project on a metered key needs a ceiling, same reasoning as the
# football-data budget in services/external_data.py.
DAILY_CALL_LIMIT = 40

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
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


_async_client = None


def _get_async_client():
    global _async_client
    if _async_client is None:
        _async_client = anthropic.AsyncAnthropic()
    return _async_client


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
# exists. None of them let Claude touch anything it could compute a figure
# from that we haven't already computed ourselves.
# ---------------------------------------------------------------------------

@beta_tool
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


@beta_tool
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


@beta_tool
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


@beta_tool
def get_bracket(competition: str = "UCL") -> str:
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


# ---------------------------------------------------------------------------
# /ai/preview — streamed narration of a single, already-computed prediction
# ---------------------------------------------------------------------------

async def preview_stream(home, away, league, prediction, goals):
    """SSE generator narrating a prediction the caller already computed.

    Effort is deliberately low and max_tokens small — this is a few sentences
    of colour on numbers that already exist, not an analysis task.
    """
    try:
        _consume()
    except RuntimeError as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
        return

    client = _get_async_client()

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
        async with client.messages.stream(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"

            final = await stream.get_final_message()
            if final.stop_reason == "refusal":
                yield f"data: {json.dumps({'error': 'The model declined to generate this preview.'})}\n\n"
    except Exception as e:
        # Covers API errors as well as client-side failures like a missing
        # ANTHROPIC_API_KEY, which the SDK raises as a plain TypeError.
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

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        output_config={"effort": "medium"},
        messages=[{"role": "user", "content": user_message}],
    )

    if response.stop_reason == "refusal":
        return {"summary": None, "refused": True}

    text = "".join(b.text for b in response.content if b.type == "text")
    return {"summary": text}


# ---------------------------------------------------------------------------
# /ai/ask — free-form Q&A over the tool set, effort high
# ---------------------------------------------------------------------------

def ask(question):
    """Runs the tool-calling loop and returns the final answer plus a trace
    of which tools were called, so the API response stays inspectable.
    """
    _consume()
    client = _get_client()

    tool_calls = []
    try:
        runner = client.beta.messages.tool_runner(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            output_config={"effort": "high"},
            tools=TOOLS,
            messages=[{"role": "user", "content": question}],
        )

        final_message = None
        for message in runner:
            final_message = message
            for block in message.content:
                if block.type == "tool_use":
                    tool_calls.append({"tool": block.name, "input": block.input})
    except Exception as e:
        # Covers API errors as well as client-side failures like a missing
        # ANTHROPIC_API_KEY, which the SDK raises as a plain TypeError.
        return {"answer": None, "error": str(e), "tool_calls": tool_calls}

    if final_message is None:
        return {"answer": "", "tool_calls": tool_calls, "stop_reason": None}

    if final_message.stop_reason == "refusal":
        detail = getattr(final_message, "stop_details", None)
        return {
            "answer": "I can't answer that one.",
            "refused": True,
            "category": getattr(detail, "category", None),
            "tool_calls": tool_calls,
        }

    text = "".join(b.text for b in final_message.content if b.type == "text")
    return {"answer": text, "tool_calls": tool_calls, "stop_reason": final_message.stop_reason}
