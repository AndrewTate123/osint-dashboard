# GEOINT Dashboard

A real-time geospatial intelligence dashboard tracking live aircraft, vessel traffic, and global conflict events — built for a Palantir/Lockheed Martin internship portfolio.

## Quick Start

```bash
bash start.sh
```

Then open **http://localhost:5173**

API documentation available at **http://localhost:8000/docs**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React + Deck.gl Frontend  (Vite, port 5173)           │
│  ├── MapView (Deck.gl ScatterplotLayers + MapLibre)     │
│  ├── Sidebar (anomaly feed, conflict events)            │
│  └── TopBar (live stats, last-update time)              │
└───────────────────────┬─────────────────────────────────┘
                        │ REST /api/*  (poll every 30s)
┌───────────────────────▼─────────────────────────────────┐
│  FastAPI Backend (uvicorn, port 8000)                   │
│  ├── flights.py   → OpenSky Network free API            │
│  ├── ships.py     → Simulated AIS (realistic)           │
│  ├── events.py    → Bundled ACLED-style dataset (50)    │
│  └── anomalies.py → Detection + aggregation             │
└─────────────────────────────────────────────────────────┘
```

## Data Sources

| Layer | Source | Notes |
|-------|--------|-------|
| Aircraft | OpenSky Network (`opensky-network.org/api`) | Free, no key, live ADS-B |
| Vessels | Simulated realistic AIS data | No free public AIS API without key |
| Conflict events | Bundled ACLED-style JSON | 50 recent events, out-of-box |

## Anomaly Detection

| Type | Condition | Severity |
|------|-----------|----------|
| Flight | Squawk 7500 (hijack) | HIGH |
| Flight | Squawk 7700 (emergency) | HIGH |
| Flight | Squawk 7600 (radio failure) | MEDIUM |
| Flight | Speed > 600 kts | MEDIUM |
| Flight | Altitude < 1000 ft over ocean | HIGH |
| Vessel | AIS gap > 12 hours | HIGH |
| Vessel | AIS gap 6–12 hours | MEDIUM |
| Vessel | Speed > 30 kts | HIGH |
| Vessel | Speed 25–30 kts | MEDIUM |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/flights` | All tracked aircraft |
| `GET /api/ships` | All tracked vessels |
| `GET /api/events` | Conflict/incident events |
| `GET /api/anomalies` | Current anomaly log |
| `GET /api/stats` | Dashboard summary stats |
| `GET /docs` | Interactive Swagger UI |

## Stack

- **Backend**: Python 3.11+, FastAPI, uvicorn, httpx
- **Frontend**: React 18, Vite 5, Deck.gl 9, react-map-gl + MapLibre GL
- **Basemap**: Carto Dark Matter (free, no API key)
