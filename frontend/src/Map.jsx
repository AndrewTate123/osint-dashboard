import React, { useCallback, useMemo } from 'react'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer } from '@deck.gl/layers'
import { Map as MapLibreMap } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

// ── Color helpers ──────────────────────────────────────────────────────────

function severityColor(severity, alpha = 255) {
  if (severity === 'HIGH')   return [239, 68,  68,  alpha]  // red
  if (severity === 'MEDIUM') return [234, 179, 8,   alpha]  // yellow
  return [34, 197, 94, alpha]                                // green
}

function flightColor(flight, alpha = 220) {
  if (!flight.anomaly) return [59, 130, 246, alpha]         // blue
  return severityColor(flight.severity, alpha)
}

function shipColor(ship, alpha = 220) {
  if (!ship.anomaly) return [20, 184, 166, alpha]           // teal
  return severityColor(ship.severity, alpha)
}

function eventColor(event) {
  const f = event.fatalities || 0
  if (f >= 20) return [239, 68, 68, 200]
  if (f >= 5)  return [234, 179, 8, 200]
  return [251, 146, 60, 180]   // orange
}

function eventRadius(event) {
  const f = event.fatalities || 0
  if (f === 0) return 40000
  return Math.max(60000, Math.min(f * 12000, 280000))
}

// ── Tooltip renderer ───────────────────────────────────────────────────────

function buildTooltip({ object, layer }) {
  if (!object) return null

  const id = layer?.id || ''
  let html = ''

  if (id.startsWith('flights')) {
    const f = object
    html = `
      <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:#7dd3fc;
                  font-family:'JetBrains Mono',monospace;letter-spacing:0.05em">
        ✈ ${f.callsign || f.id}
      </div>
      ${f.anomaly ? `
        <div style="color:#ef4444;font-weight:700;font-size:11px;
                    background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);
                    border-radius:4px;padding:3px 8px;margin-bottom:8px;letter-spacing:0.05em">
          ⚠ ${f.anomaly_reason}
        </div>` : ''}
      <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11px">
        <span style="color:#64748b">COUNTRY</span><span style="font-family:monospace">${f.country || '—'}</span>
        <span style="color:#64748b">ALT</span><span style="font-family:monospace">${f.altitude ? f.altitude.toLocaleString() + ' ft' : '—'}</span>
        <span style="color:#64748b">SPEED</span><span style="font-family:monospace">${f.speed ? f.speed + ' kts' : '—'}</span>
        <span style="color:#64748b">HDG</span><span style="font-family:monospace">${f.heading != null ? f.heading + '°' : '—'}</span>
        <span style="color:#64748b">SQUAWK</span><span style="font-family:monospace;${['7500','7600','7700'].includes(f.squawk) ? 'color:#ef4444;font-weight:700' : ''}">${f.squawk || '—'}</span>
        <span style="color:#64748b">POS</span><span style="font-family:monospace">${Math.abs(f.lat).toFixed(2)}°${f.lat>=0?'N':'S'} ${Math.abs(f.lon).toFixed(2)}°${f.lon>=0?'E':'W'}</span>
      </div>`
  } else if (id.startsWith('ships')) {
    const s = object
    html = `
      <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:#2dd4bf;
                  font-family:'JetBrains Mono',monospace;letter-spacing:0.05em">
        ⛴ ${s.name || s.id}
      </div>
      ${s.anomaly ? `
        <div style="color:#ef4444;font-weight:700;font-size:11px;
                    background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);
                    border-radius:4px;padding:3px 8px;margin-bottom:8px;letter-spacing:0.05em">
          ⚠ ${s.anomaly_reason}
        </div>` : ''}
      <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11px">
        <span style="color:#64748b">TYPE</span><span style="font-family:monospace">${s.type || '—'}</span>
        <span style="color:#64748b">FLAG</span><span style="font-family:monospace">${s.flag || '—'}</span>
        <span style="color:#64748b">SPEED</span><span style="font-family:monospace">${s.speed ? s.speed + ' kts' : '—'}</span>
        <span style="color:#64748b">HDG</span><span style="font-family:monospace">${s.heading != null ? s.heading + '°' : '—'}</span>
        <span style="color:#64748b">AIS GAP</span><span style="font-family:monospace;${s.ais_gap_hours > 6 ? 'color:#ef4444;font-weight:700' : ''}">${s.ais_gap_hours > 0 ? s.ais_gap_hours + 'h' : 'Current'}</span>
        <span style="color:#64748b">POS</span><span style="font-family:monospace">${Math.abs(s.lat).toFixed(2)}°${s.lat>=0?'N':'S'} ${Math.abs(s.lon).toFixed(2)}°${s.lon>=0?'E':'W'}</span>
      </div>`
  } else if (id.startsWith('events')) {
    const ev = object
    html = `
      <div style="margin-bottom:6px;font-size:13px;font-weight:700;color:#f87171;
                  font-family:'JetBrains Mono',monospace;letter-spacing:0.05em">
        ⚠ ${ev.type}
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;line-height:1.5">${ev.description}</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11px">
        <span style="color:#64748b">COUNTRY</span><span style="font-family:monospace">${ev.country}</span>
        <span style="color:#64748b">DATE</span><span style="font-family:monospace">${ev.date}</span>
        <span style="color:#64748b">FATALITIES</span><span style="font-family:monospace;${ev.fatalities > 0 ? 'color:#ef4444;font-weight:700' : ''}">${ev.fatalities}</span>
        <span style="color:#64748b">POS</span><span style="font-family:monospace">${Math.abs(ev.lat).toFixed(2)}°${ev.lat>=0?'N':'S'} ${Math.abs(ev.lon).toFixed(2)}°${ev.lon>=0?'E':'W'}</span>
      </div>`
  }

  return { html, style: { fontFamily: "'Inter', sans-serif" } }
}

// ── Free dark basemap style ────────────────────────────────────────────────
// Uses Carto Voyager Dark — no API key required
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export default function MapView({
  flights,
  ships,
  events,
  visible,
  onSelectEntity,
  viewState,
  onViewStateChange,
}) {

  // Flight layers
  const flightLayers = useMemo(() => {
    if (!visible.flights) return []

    const normalFlights = flights.filter(f => !f.anomaly)
    const anomalyFlights = flights.filter(f => f.anomaly)

    return [
      // Normal flights — scatter dots
      new ScatterplotLayer({
        id: 'flights-normal',
        data: normalFlights,
        getPosition: d => [d.lon, d.lat],
        getColor: d => flightColor(d, 180),
        getRadius: 8000,
        radiusMinPixels: 2,
        radiusMaxPixels: 5,
        pickable: true,
        onClick: ({ object }) => onSelectEntity && onSelectEntity({ type: 'flight', data: object }),
      }),
      // Anomaly flights — larger, glowing
      new ScatterplotLayer({
        id: 'flights-anomaly-glow',
        data: anomalyFlights,
        getPosition: d => [d.lon, d.lat],
        getColor: d => [...severityColor(d.severity, 50)],
        getRadius: 60000,
        radiusMinPixels: 12,
        radiusMaxPixels: 22,
        pickable: false,
        stroked: false,
      }),
      new ScatterplotLayer({
        id: 'flights-anomaly',
        data: anomalyFlights,
        getPosition: d => [d.lon, d.lat],
        getColor: d => flightColor(d, 255),
        getRadius: 18000,
        radiusMinPixels: 5,
        radiusMaxPixels: 10,
        pickable: true,
        stroked: true,
        getLineColor: d => severityColor(d.severity, 255),
        lineWidthMinPixels: 1,
        onClick: ({ object }) => onSelectEntity && onSelectEntity({ type: 'flight', data: object }),
      }),
      // Heading indicators (directional lines)
      new ScatterplotLayer({
        id: 'flights-heading',
        data: normalFlights.filter(f => f.heading != null),
        getPosition: d => {
          const rad = (d.heading * Math.PI) / 180
          return [
            d.lon + Math.sin(rad) * 0.15,
            d.lat + Math.cos(rad) * 0.15,
          ]
        },
        getColor: d => [59, 130, 246, 80],
        getRadius: 3000,
        radiusMinPixels: 1,
        radiusMaxPixels: 2,
        pickable: false,
      }),
    ]
  }, [flights, visible.flights, onSelectEntity])

  // Ship layers
  const shipLayers = useMemo(() => {
    if (!visible.ships) return []

    const normalShips = ships.filter(s => !s.anomaly)
    const anomalyShips = ships.filter(s => s.anomaly)

    return [
      // Normal ships
      new ScatterplotLayer({
        id: 'ships-normal',
        data: normalShips,
        getPosition: d => [d.lon, d.lat],
        getColor: d => shipColor(d, 200),
        getRadius: 12000,
        radiusMinPixels: 3,
        radiusMaxPixels: 6,
        pickable: true,
        onClick: ({ object }) => onSelectEntity && onSelectEntity({ type: 'ship', data: object }),
      }),
      // Anomaly ships
      new ScatterplotLayer({
        id: 'ships-anomaly-glow',
        data: anomalyShips,
        getPosition: d => [d.lon, d.lat],
        getColor: d => [...severityColor(d.severity, 40)],
        getRadius: 80000,
        radiusMinPixels: 14,
        radiusMaxPixels: 24,
        pickable: false,
      }),
      new ScatterplotLayer({
        id: 'ships-anomaly',
        data: anomalyShips,
        getPosition: d => [d.lon, d.lat],
        getColor: d => shipColor(d, 255),
        getRadius: 25000,
        radiusMinPixels: 6,
        radiusMaxPixels: 12,
        pickable: true,
        stroked: true,
        getLineColor: d => severityColor(d.severity, 255),
        lineWidthMinPixels: 1.5,
        onClick: ({ object }) => onSelectEntity && onSelectEntity({ type: 'ship', data: object }),
      }),
    ]
  }, [ships, visible.ships, onSelectEntity])

  // Event layers
  const eventLayers = useMemo(() => {
    if (!visible.events) return []

    return [
      // Outer glow ring
      new ScatterplotLayer({
        id: 'events-glow',
        data: events,
        getPosition: d => [d.lon, d.lat],
        getColor: d => [...eventColor(d).slice(0, 3), 40],
        getRadius: d => eventRadius(d) * 1.8,
        radiusMinPixels: 8,
        radiusMaxPixels: 40,
        pickable: false,
        stroked: false,
      }),
      // Main dot
      new ScatterplotLayer({
        id: 'events-main',
        data: events,
        getPosition: d => [d.lon, d.lat],
        getColor: d => eventColor(d),
        getRadius: d => eventRadius(d),
        radiusMinPixels: 5,
        radiusMaxPixels: 24,
        pickable: true,
        stroked: true,
        getLineColor: d => [...eventColor(d).slice(0, 3), 255],
        lineWidthMinPixels: 1,
        onClick: ({ object }) => onSelectEntity && onSelectEntity({ type: 'event', data: object }),
      }),
    ]
  }, [events, visible.events, onSelectEntity])

  const allLayers = [...flightLayers, ...shipLayers, ...eventLayers]

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={({ viewState: vs }) => onViewStateChange(vs)}
      controller={true}
      layers={allLayers}
      getTooltip={buildTooltip}
      style={{ position: 'absolute', inset: 0 }}
    >
      <MapLibreMap
        mapStyle={MAP_STYLE}
        attributionControl={false}
      />
    </DeckGL>
  )
}
