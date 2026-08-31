import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.cache import cache
from services.external_data import get_featured_fixtures, request_budget

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# The API-Football key is a Free plan: 100 requests/day. Every scheduled job
# spends from that same budget as user traffic, so there is exactly one job and
# it runs every 3 hours (8 requests/day).
FIXTURES_REFRESH_HOURS = 3


async def refresh_todays_fixtures():
    """Re-fetch today's fixtures for the top 5 leagues."""
    logger.info("Refreshing today's fixtures... (%s)", request_budget())
    try:
        # get_featured_fixtures is @cached, so drop its entry first or the
        # refresh is a no-op that just returns the stale value.
        cache.invalidate("fixtures:get_featured_fixtures:():[]")
        fixtures = await get_featured_fixtures()
        logger.info("Refreshed fixtures: %d matches found", len(fixtures))
    except Exception as e:
        logger.error("Error refreshing fixtures: %s", e)


def setup_scheduler():
    """Configure and return the scheduler."""
    scheduler.add_job(
        refresh_todays_fixtures,
        trigger=IntervalTrigger(hours=FIXTURES_REFRESH_HOURS),
        id="refresh_fixtures",
        name="Refresh Today's Fixtures",
        replace_existing=True,
        max_instances=1,
    )
    return scheduler


def get_scheduler_status():
    """Status of all scheduled jobs."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        })

    return {
        "scheduler_running": scheduler.running,
        "jobs": jobs,
        "api_budget": request_budget(),
    }
