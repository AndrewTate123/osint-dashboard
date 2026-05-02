"""
OSINT Geospatial Intelligence Dashboard — FastAPI Backend
Polls external data sources every 30 seconds and serves via REST API.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import logging
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from flights import fetch_flights, get_cached_flights
from ships import fetch_ships, get_cached_ships
from events import load_events, get_cached_events
from anomalies import update_anomaly_log, get_anomaly_log, get_anomaly_stats

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

POLL_INTERVAL = 30  # seconds
_last_update: str = ""


async def polling_loop():
    """Background task: polls APIs every 30 seconds."""
    global _last_update
    while True:
        try:
            logger.info("Polling data sources...")
            flights, ships = await asyncio.gather(
                fetch_flights(),
                fetch_ships(),
            )
            update_anomaly_log(flights, ships)
            _last_update = datetime.now(timezone.utc).isoformat()
            logger.info(
                f"Updated: {len(flights)} flights, {len(ships)} ships, "
                f"{len(get_anomaly_log())} anomalies"
            )
        except Exception as e:
            logger.error(f"Polling error: {e}")
        await asyncio.sleep(POLL_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load static data and do first poll
    load_events()
    task = asyncio.create_task(polling_loop())
    yield
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="OSINT Dashboard API",
    description="Geospatial Intelligence Dashboard — Flight, Ship, and Conflict Event Tracking",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/flights")
async def get_flights():
    """Returns all tracked airborne aircraft."""
    return get_cached_flights()


@app.get("/api/ships")
async def get_ships():
    """Returns all tracked vessels."""
    return get_cached_ships()


@app.get("/api/events")
async def get_events():
    """Returns conflict/incident events."""
    return get_cached_events()


@app.get("/api/anomalies")
async def get_anomalies():
    """Returns the current anomaly log, sorted by severity."""
    return get_anomaly_log()


@app.get("/api/stats")
async def get_stats():
    """Returns summary statistics for the dashboard header."""
    flights = get_cached_flights()
    ships = get_cached_ships()
    stats = get_anomaly_stats(flights, ships)
    stats["last_update"] = _last_update
    return stats


@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


# Serve built React frontend (production)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
