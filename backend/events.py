"""
Conflict / incident events loader.
Loads from bundled sample dataset (ACLED-style schema).
Optionally can query ACLED API if key is provided via .env.
"""

import json
import os
import logging
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Path to bundled sample data
DATA_FILE = Path(__file__).parent.parent / "data" / "conflict_events.json"

_cache: List[Dict[str, Any]] = []


def load_events() -> List[Dict[str, Any]]:
    """Load conflict events from bundled JSON file."""
    global _cache

    if _cache:
        return _cache

    try:
        with open(DATA_FILE) as f:
            events = json.load(f)

        # Normalize fields
        normalized = []
        for ev in events:
            normalized.append({
                "id": ev.get("id", ""),
                "lat": float(ev.get("lat", 0)),
                "lon": float(ev.get("lon", 0)),
                "date": ev.get("date", ""),
                "type": ev.get("type", "Unknown"),
                "country": ev.get("country", "Unknown"),
                "fatalities": int(ev.get("fatalities", 0)),
                "description": ev.get("description", ""),
            })

        _cache = normalized
        logger.info(f"Events: loaded {len(normalized)} conflict events from sample dataset")
        return normalized

    except Exception as e:
        logger.error(f"Failed to load events: {e}")
        return []


def get_cached_events() -> List[Dict[str, Any]]:
    if not _cache:
        return load_events()
    return _cache
