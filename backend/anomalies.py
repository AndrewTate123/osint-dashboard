"""
Anomaly detection and log management.
Aggregates anomalies from flights and ships into a unified feed.
"""

from typing import List, Dict, Any
from datetime import datetime, timezone
import asyncio

# Rolling anomaly log (last 200 entries)
_anomaly_log: List[Dict[str, Any]] = []
MAX_LOG_SIZE = 200


def _make_anomaly_entry(
    entity_type: str,
    entity_id: str,
    entity_name: str,
    lat: float,
    lon: float,
    reason: str,
    severity: str,
) -> Dict[str, Any]:
    return {
        "id": f"{entity_type}_{entity_id}_{int(datetime.now(timezone.utc).timestamp())}",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "lat": lat,
        "lon": lon,
        "reason": reason,
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def extract_anomalies_from_flights(flights: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract anomalous flights and return as anomaly entries."""
    entries = []
    for f in flights:
        if f.get("anomaly"):
            entries.append(_make_anomaly_entry(
                entity_type="FLIGHT",
                entity_id=f["id"],
                entity_name=f.get("callsign", f["id"]),
                lat=f["lat"],
                lon=f["lon"],
                reason=f.get("anomaly_reason", "Unknown anomaly"),
                severity=f.get("severity", "MEDIUM"),
            ))
    return entries


def extract_anomalies_from_ships(ships: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract anomalous ships and return as anomaly entries."""
    entries = []
    for s in ships:
        if s.get("anomaly"):
            entries.append(_make_anomaly_entry(
                entity_type="VESSEL",
                entity_id=s["id"],
                entity_name=s.get("name", s["id"]),
                lat=s["lat"],
                lon=s["lon"],
                reason=s.get("anomaly_reason", "Unknown anomaly"),
                severity=s.get("severity", "MEDIUM"),
            ))
    return entries


def update_anomaly_log(
    flights: List[Dict[str, Any]],
    ships: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Rebuild anomaly log from current flight/ship data."""
    global _anomaly_log

    new_entries = []
    new_entries.extend(extract_anomalies_from_flights(flights))
    new_entries.extend(extract_anomalies_from_ships(ships))

    # Sort by severity then timestamp
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "NONE": 3}
    new_entries.sort(key=lambda x: (severity_order.get(x["severity"], 3), x["timestamp"]))

    _anomaly_log = new_entries[:MAX_LOG_SIZE]
    return _anomaly_log


def get_anomaly_log() -> List[Dict[str, Any]]:
    return _anomaly_log


def get_anomaly_stats(flights: List[Dict[str, Any]], ships: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Return summary statistics."""
    flight_anomalies = [f for f in flights if f.get("anomaly")]
    ship_anomalies = [s for s in ships if s.get("anomaly")]

    high_count = sum(1 for e in _anomaly_log if e["severity"] == "HIGH")
    medium_count = sum(1 for e in _anomaly_log if e["severity"] == "MEDIUM")

    return {
        "total_flights": len(flights),
        "total_ships": len(ships),
        "flight_anomalies": len(flight_anomalies),
        "ship_anomalies": len(ship_anomalies),
        "total_anomalies": len(flight_anomalies) + len(ship_anomalies),
        "high_severity": high_count,
        "medium_severity": medium_count,
    }
