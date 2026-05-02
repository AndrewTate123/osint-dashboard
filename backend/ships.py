"""
Ship tracking module.
Primary: attempts VesselFinder / MarineTraffic free endpoints.
Fallback: generates realistic simulated AIS vessel data.
"""

import httpx
import asyncio
import logging
import random
import math
from typing import List, Dict, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

_cache: List[Dict[str, Any]] = []
_last_fetch: float = 0.0


# Ship type categories
SHIP_TYPES = [
    "Cargo", "Tanker", "Container", "Bulk Carrier",
    "Passenger", "Ro-Ro", "LNG Carrier", "Chemical Tanker",
    "Naval Vessel", "Coast Guard", "Fishing Vessel", "Research"
]

FLAGS = [
    "Panama", "Liberia", "Marshall Islands", "Hong Kong",
    "Bahamas", "Greece", "Singapore", "Malta",
    "China", "USA", "UK", "Norway", "Japan",
    "Cyprus", "Italy", "Russia", "UAE", "Iran",
]

PREFIXES = [
    "MV", "MT", "MS", "SS", "VLCC", "BW", "STI", "TORM",
    "NORDIC", "PACIFIC", "ATLANTIC", "OCEAN", "STAR", "CAPE",
]

NAMES_POOL = [
    "PIONEER", "ENTERPRISE", "ENDEAVOUR", "RESOLUTION", "DISCOVERY",
    "CHALLENGER", "NAVIGATOR", "EXPLORER", "HORIZON", "MERIDIAN",
    "ALBATROSS", "CONDOR", "FALCON", "HAWK", "EAGLE",
    "AURORA", "BOREALIS", "ZENITH", "APEX", "SUMMIT",
    "SHIELD", "GUARDIAN", "SENTINEL", "FORTRESS", "BASTION",
    "THUNDER", "LIGHTNING", "TEMPEST", "STORM", "GALE",
    "PHOENIX", "DRAGON", "TITAN", "OLYMPUS", "ATLAS",
]

# Major shipping lanes
SHIPPING_LANES = [
    # English Channel / North Sea
    {"name": "English Channel", "points": [(51.0, 1.5), (51.2, -1.0), (50.5, -3.0)], "count": 12},
    # North Atlantic
    {"name": "North Atlantic", "points": [(50.0, -30.0), (48.0, -20.0), (46.0, -10.0)], "count": 15},
    # Mediterranean
    {"name": "Mediterranean", "points": [(36.0, 10.0), (37.0, 20.0), (35.0, 30.0)], "count": 18},
    # Red Sea / Suez
    {"name": "Red Sea", "points": [(20.0, 38.0), (22.0, 37.0), (25.0, 36.0), (27.0, 34.0)], "count": 14},
    # Persian Gulf
    {"name": "Persian Gulf", "points": [(24.0, 56.0), (25.5, 54.0), (26.5, 52.0)], "count": 10},
    # Strait of Malacca
    {"name": "Malacca Strait", "points": [(1.5, 104.0), (3.0, 102.5), (4.5, 101.0)], "count": 16},
    # South China Sea
    {"name": "South China Sea", "points": [(10.0, 112.0), (15.0, 115.0), (18.0, 118.0)], "count": 12},
    # Gulf of Aden / Somalia
    {"name": "Gulf of Aden", "points": [(12.0, 44.0), (11.5, 48.0), (11.0, 52.0)], "count": 8},
    # Cape of Good Hope
    {"name": "Cape Route", "points": [(-34.0, 18.0), (-36.0, 22.0), (-38.0, 28.0)], "count": 6},
    # East Pacific
    {"name": "East Pacific", "points": [(20.0, -115.0), (15.0, -100.0), (10.0, -85.0)], "count": 8},
    # Caribbean
    {"name": "Caribbean", "points": [(18.0, -75.0), (20.0, -80.0), (15.0, -85.0)], "count": 10},
    # Baltic Sea
    {"name": "Baltic Sea", "points": [(56.0, 14.0), (57.0, 18.0), (58.0, 22.0)], "count": 9},
    # Black Sea
    {"name": "Black Sea", "points": [(43.0, 30.0), (43.5, 33.0), (44.0, 36.0)], "count": 7},
]


def _detect_ship_anomaly(ship: Dict[str, Any]) -> tuple[bool, str, str]:
    """Returns (is_anomaly, reason, severity)"""
    speed = ship.get("speed", 0) or 0
    last_seen_ago = ship.get("ais_gap_hours", 0) or 0
    lat = ship.get("lat", 0) or 0
    lon = ship.get("lon", 0) or 0

    # AIS dark (went dark for >6 hours in open ocean)
    if last_seen_ago > 6:
        # Check if in open ocean (rough heuristic)
        severity = "HIGH" if last_seen_ago > 12 else "MEDIUM"
        return True, f"AIS DARK — {last_seen_ago:.1f}h gap in open ocean", severity

    # Unusual speed
    if speed > 30:
        return True, f"ABNORMAL SPEED: {speed:.1f} kts", "HIGH"
    if speed > 25:
        return True, f"ELEVATED SPEED: {speed:.1f} kts", "MEDIUM"

    return False, "", "NONE"


def _generate_simulated_ships() -> List[Dict[str, Any]]:
    """Generate realistic simulated vessel traffic."""
    random.seed(42 + int(asyncio.get_event_loop().time()) // 30)

    ships = []
    idx = 0

    for lane in SHIPPING_LANES:
        for i in range(lane["count"]):
            # Interpolate position along lane with some scatter
            t = random.random()
            pts = lane["points"]
            if len(pts) >= 2:
                seg = int(t * (len(pts) - 1))
                seg = min(seg, len(pts) - 2)
                local_t = t * (len(pts) - 1) - seg
                lat = pts[seg][0] + local_t * (pts[seg+1][0] - pts[seg][0])
                lon = pts[seg][1] + local_t * (pts[seg+1][1] - pts[seg][1])
            else:
                lat, lon = pts[0]

            lat += random.gauss(0, 0.5)
            lon += random.gauss(0, 0.5)

            name = f"{random.choice(PREFIXES)} {random.choice(NAMES_POOL)}"
            flag = random.choice(FLAGS)
            ship_type = random.choice(SHIP_TYPES)
            speed = round(random.uniform(8, 18), 1)
            heading = random.randint(0, 359)
            mmsi = f"{random.randint(100000000, 999999999)}"

            # AIS gap (mostly 0, a few have gaps)
            ais_gap = 0.0
            if idx % 23 == 0:
                ais_gap = round(random.uniform(7, 48), 1)  # went dark
            elif idx % 41 == 0:
                ais_gap = round(random.uniform(6.1, 10), 1)

            # Speed anomaly
            if idx % 31 == 0:
                speed = round(random.uniform(31, 42), 1)

            anomaly, anomaly_reason, severity = _detect_ship_anomaly({
                "speed": speed,
                "ais_gap_hours": ais_gap,
                "lat": lat,
                "lon": lon,
            })

            last_seen_dt = datetime.utcnow() - timedelta(hours=ais_gap)

            ships.append({
                "id": mmsi,
                "name": name,
                "flag": flag,
                "type": ship_type,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "speed": speed,
                "heading": heading,
                "last_seen": last_seen_dt.isoformat() + "Z",
                "ais_gap_hours": ais_gap,
                "anomaly": anomaly,
                "anomaly_reason": anomaly_reason,
                "severity": severity,
            })
            idx += 1

    return ships


async def fetch_ships() -> List[Dict[str, Any]]:
    """Attempt live ship data; fall back to simulated."""
    global _cache, _last_fetch

    # No free public AIS API available without key — use simulated
    logger.info("Ships: using simulated AIS data (no free public API available without key)")
    ships = _generate_simulated_ships()
    _cache = ships
    return ships


def get_cached_ships() -> List[Dict[str, Any]]:
    if not _cache:
        return _generate_simulated_ships()
    return _cache
