from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import logging

from services.external_data import get_featured_fixtures, get_injuries, get_squad
from services.cache import cache

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create scheduler instance
scheduler = AsyncIOScheduler()

# Active leagues for refresh
ACTIVE_LEAGUES = ["PL", "LL", "SA", "L1", "BL"]

async def refresh_todays_fixtures():
    """Refresh today's fixtures for all active leagues every 30 minutes during 06:00-23:00"""
    logger.info("Refreshing today's fixtures...")
    try:
        # Clear existing fixtures cache to force refresh
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        cache_key = f"fixtures:{today}"
        cache.clear(cache_key)
        
        # Fetch fresh fixtures
        fixtures = await get_featured_fixtures()
        logger.info(f"Refreshed fixtures: {len(fixtures)} matches found")
    except Exception as e:
        logger.error(f"Error refreshing fixtures: {e}")

async def refresh_live_scores():
    """Poll API-Football for in-progress matches every 60 seconds between 12:00-23:00"""
    logger.info("Refreshing live scores...")
    try:
        # This would call API-Football for live matches
        # For now, we'll just log - implementation would need live match endpoint
        logger.info("Live scores refresh completed (placeholder)")
    except Exception as e:
        logger.error(f"Error refreshing live scores: {e}")

async def refresh_injury_data():
    """Refresh injury lists for all teams currently in cache, runs nightly at 02:00"""
    logger.info("Refreshing injury data...")
    try:
        # Get all teams from TEAM_ID_MAP in api.py
        from services.api import TEAM_ID_MAP
        
        refreshed_count = 0
        for team_name, team_id in TEAM_ID_MAP.items():
            try:
                # Clear cache for this team's injuries
                cache_key = f"injuries:{team_id}:2024"
                cache.clear(cache_key)
                
                # Fetch fresh injury data
                injuries = await get_injuries(team_id, season=2024)
                refreshed_count += 1
            except Exception as e:
                logger.error(f"Error refreshing injuries for {team_name}: {e}")
        
        logger.info(f"Refreshed injury data for {refreshed_count} teams")
    except Exception as e:
        logger.error(f"Error in injury data refresh: {e}")

async def refresh_squad_data():
    """Refresh squad rosters for recently queried teams, runs nightly at 03:00"""
    logger.info("Refreshing squad data...")
    try:
        # Get all teams from TEAM_ID_MAP in api.py
        from services.api import TEAM_ID_MAP
        
        refreshed_count = 0
        for team_name, team_id in TEAM_ID_MAP.items():
            try:
                # Clear cache for this team's squad
                cache_key = f"squad:{team_id}"
                cache.clear(cache_key)
                
                # Fetch fresh squad data
                squad = await get_squad(team_id)
                refreshed_count += 1
            except Exception as e:
                logger.error(f"Error refreshing squad for {team_name}: {e}")
        
        logger.info(f"Refreshed squad data for {refreshed_count} teams")
    except Exception as e:
        logger.error(f"Error in squad data refresh: {e}")

def setup_scheduler():
    """Configure and return the scheduler with all jobs"""
    # Refresh fixtures every 30 minutes between 06:00-23:00
    scheduler.add_job(
        refresh_todays_fixtures,
        trigger=IntervalTrigger(minutes=30),
        id='refresh_fixtures',
        name='Refresh Today\'s Fixtures',
        replace_existing=True,
        max_instances=1
    )
    
    # Refresh live scores every 60 seconds between 12:00-23:00
    scheduler.add_job(
        refresh_live_scores,
        trigger=IntervalTrigger(seconds=60),
        id='refresh_live_scores',
        name='Refresh Live Scores',
        replace_existing=True,
        max_instances=1
    )
    
    # Refresh injury data nightly at 02:00
    scheduler.add_job(
        refresh_injury_data,
        trigger=CronTrigger(hour=2, minute=0),
        id='refresh_injuries',
        name='Refresh Injury Data',
        replace_existing=True,
        max_instances=1
    )
    
    # Refresh squad data nightly at 03:00
    scheduler.add_job(
        refresh_squad_data,
        trigger=CronTrigger(hour=3, minute=0),
        id='refresh_squads',
        name='Refresh Squad Data',
        replace_existing=True,
        max_instances=1
    )
    
    return scheduler

def get_scheduler_status():
    """Get status of all scheduled jobs"""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "last_run_time": job.last_run_time.isoformat() if job.last_run_time else None,
            "trigger": str(job.trigger)
        })
    
    return {
        "scheduler_running": scheduler.running,
        "jobs": jobs
    }
