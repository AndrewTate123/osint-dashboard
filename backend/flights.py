"""
Flight tracking via OpenSky Network free API.
No API key required. Polls every 30 seconds via background task in main.py.
"""

import httpx
import asyncio
import logging
import random
import math
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

OPENSKY_URL = "https://opensky-network.org/api/states/all"

# Emergency squawk codes
EMERGENCY_SQUAWKS = {
    "7500": "HIJACK",
    "7600": "RADIO FAILURE",
    "7700": "EMERGENCY",
    "7600": "RADIO_LOSS",
}

_cache: List[Dict[str, Any]] = []
_last_fetch: float = 0.0


def _squawk_severity(squawk: str) -> str:
    if squawk == "7500":
        return "HIGH"
    elif squawk == "7700":
        return "HIGH"
    elif squawk == "7600":
        return "MEDIUM"
    return "NONE"


def _detect_flight_anomaly(flight: Dict[str, Any]) -> tuple[bool, str, str]:
    """Returns (is_anomaly, reason, severity)"""
    squawk = flight.get("squawk", "")
    altitude = flight.get("altitude", 0) or 0
    speed = flight.get("speed", 0) or 0
    lat = flight.get("lat", 0) or 0
    lon = flight.get("lon", 0) or 0

    # Emergency squawks
    if squawk == "7500":
        return True, "SQUAWK 7500 — POSSIBLE HIJACK", "HIGH"
    if squawk == "7700":
        return True, "SQUAWK 7700 — GENERAL EMERGENCY", "HIGH"
    if squawk == "7600":
        return True, "SQUAWK 7600 — RADIO FAILURE", "MEDIUM"

    # Unusually high speed
    if speed and speed > 600:
        return True, f"UNUSUAL SPEED: {speed:.0f} kts", "MEDIUM"

    # Low altitude over ocean (rough check: far from any continent)
    if altitude and altitude > 0 and altitude < 1000:
        # Basic ocean check: abs(lat) < 60 and not near known land masses
        if abs(lat) < 60 and (
            (lon > -30 and lon < -10)        # Mid-Atlantic
            or (lon > 60 and lon < 120 and lat < 10)  # Indian Ocean
            or (lon > -180 and lon < -120 and lat < 20)  # Pacific
        ):
            return True, f"LOW ALTITUDE OVER OCEAN: {altitude:.0f} ft", "HIGH"

    return False, "", "NONE"


def _parse_opensky_state(state: list) -> Dict[str, Any] | None:
    """Parse a single OpenSky state vector into our flight object."""
    try:
        icao24 = state[0] or ""
        callsign = (state[1] or "").strip()
        origin_country = state[2] or ""
        lon = state[5]
        lat = state[6]
        altitude = state[7]  # baro altitude in meters
        on_ground = state[8]
        speed = state[9]     # velocity m/s
        heading = state[10]  # true track
        squawk = state[14] or ""

        # Skip ground aircraft and those without position
        if on_ground or lat is None or lon is None:
            return None

        # Convert units
        alt_ft = round(altitude * 3.28084, 0) if altitude else None
        speed_kts = round(speed * 1.94384, 0) if speed else None
        heading_deg = round(heading, 0) if heading else None

        flight = {
            "id": icao24,
            "callsign": callsign or icao24,
            "country": origin_country,
            "lat": lat,
            "lon": lon,
            "altitude": alt_ft,
            "speed": speed_kts,
            "heading": heading_deg,
            "squawk": squawk,
            "anomaly": False,
            "anomaly_reason": "",
            "severity": "NONE",
        }

        is_anomaly, reason, severity = _detect_flight_anomaly(flight)
        flight["anomaly"] = is_anomaly
        flight["anomaly_reason"] = reason
        flight["severity"] = severity

        return flight
    except (IndexError, TypeError, ValueError) as e:
        return None


def _generate_simulated_flights() -> List[Dict[str, Any]]:
    """Generate realistic simulated flight data as fallback."""
    import random
    random.seed(int(asyncio.get_event_loop().time()) // 30)  # changes every 30s

    flights = []
    # Major flight corridors
    corridors = [
        # North Atlantic (JFK-LHR)
        {"lat_range": (45, 60), "lon_range": (-70, -10), "count": 25},
        # Europe
        {"lat_range": (35, 55), "lon_range": (-10, 30), "count": 30},
        # Middle East
        {"lat_range": (20, 35), "lon_range": (30, 60), "count": 15},
        # Southeast Asia
        {"lat_range": (0, 25), "lon_range": (95, 135), "count": 20},
        # North America
        {"lat_range": (25, 55), "lon_range": (-125, -70), "count": 35},
        # Eastern Europe / Ukraine area
        {"lat_range": (44, 56), "lon_range": (22, 42), "count": 10},
    ]

    callsign_prefixes = ["UAL", "DAL", "AAL", "BAW", "AFR", "DLH", "UAE", "QTR",
                         "SIA", "CPA", "ANA", "JAL", "KAL", "THA", "ETH", "QFA"]

    idx = 0
    for corridor in corridors:
        for _ in range(corridor["count"]):
            lat = random.uniform(*corridor["lat_range"])
            lon = random.uniform(*corridor["lon_range"])
            callsign = f"{random.choice(callsign_prefixes)}{random.randint(100, 999)}"
            altitude = random.choice([28000, 30000, 32000, 34000, 35000, 36000, 37000, 38000, 40000])
            speed = random.randint(420, 520)
            heading = random.randint(0, 359)
            squawk = "2200"  # normal

            # Inject a few anomalies
            severity = "NONE"
            anomaly = False
            anomaly_reason = ""
            if idx % 47 == 0:
                squawk = "7700"
                anomaly = True
                anomaly_reason = "SQUAWK 7700 — GENERAL EMERGENCY"
                severity = "HIGH"
            elif idx % 73 == 0:
                squawk = "7600"
                anomaly = True
                anomaly_reason = "SQUAWK 7600 — RADIO FAILURE"
                severity = "MEDIUM"
            elif idx % 91 == 0:
                squawk = "7500"
                anomaly = True
                anomaly_reason = "SQUAWK 7500 — POSSIBLE HIJACK"
                severity = "HIGH"
            elif idx % 37 == 0:
                speed = random.randint(610, 660)
                anomaly = True
                anomaly_reason = f"UNUSUAL SPEED: {speed} kts"
                severity = "MEDIUM"

            flights.append({
                "id": f"SIM{idx:04d}",
                "callsign": callsign,
                "country": "Unknown",
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "altitude": altitude,
                "speed": speed,
                "heading": heading,
                "squawk": squawk,
                "anomaly": anomaly,
                "anomaly_reason": anomaly_reason,
                "severity": severity,
            })
            idx += 1

    return flights


async def fetch_flights() -> List[Dict[str, Any]]:
    """Fetch live flight data from OpenSky Network. Falls back to simulated data."""
    global _cache, _last_fetch

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                OPENSKY_URL,
                params={"lamin": -60, "lamax": 72, "lomin": -130, "lomax": 145}
            )
            resp.raise_for_status()
            data = resp.json()
            states = data.get("states", []) or []

            flights = []
            for state in states:
                parsed = _parse_opensky_state(state)
                if parsed:
                    flights.append(parsed)

            # Limit to 500 aircraft for performance
            flights = flights[:500]

            logger.info(f"OpenSky: fetched {len(flights)} airborne aircraft")
            _cache = flights
            _last_fetch = asyncio.get_event_loop().time()
            return flights

    except Exception as e:
        logger.warning(f"OpenSky fetch failed ({e}), using simulated data")
        if not _cache:
            _cache = _generate_simulated_flights()
        return _cache


def get_cached_flights() -> List[Dict[str, Any]]:
    if not _cache:
        return _generate_simulated_flights()
    return _cache
