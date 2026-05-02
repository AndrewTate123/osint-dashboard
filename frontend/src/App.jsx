import React, { useState, useEffect, useCallback } from 'react'
import { FlyToInterpolator } from '@deck.gl/core'
import MapView from './Map.jsx'
import Sidebar from './Sidebar.jsx'
import LayerControls from './LayerControls.jsx'

const API = ''
const POLL_INTERVAL = 30_000 // 30 seconds

function formatLastUpdate(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' UTC'
}

function StatChip({ icon, label, value, variant }) {
  return (
    <div className={`stat-chip ${variant ? `stat-chip--${variant}` : ''}`}>
      <span className="stat-chip__icon">{icon}</span>
      <span className="stat-chip__label">{label}</span>
      <span className="stat-chip__value">{value ?? '—'}</span>
    </div>
  )
}

const SQUAWK_MEANINGS = {
  '7500': 'HIJACK IN PROGRESS',
  '7600': 'RADIO COMMUNICATIONS FAILURE',
  '7700': 'GENERAL EMERGENCY / MAYDAY',
}

function DetailPanel({ selected, onClose }) {
  if (!selected) return null
  const { type, data } = selected

  let title = ''
  let subtitle = ''
  let rows = []
  let alertBlock = null
  let descBlock = null

  if (type === 'flight') {
    const f = data
    const squawkMeaning = SQUAWK_MEANINGS[f.squawk]
    title = `✈ ${f.callsign || f.id}`
    subtitle = f.country || ''
    rows = [
      ['ICAO24', f.id],
      ['ORIGIN', f.country || '—'],
      ['ALTITUDE', f.altitude ? `${f.altitude.toLocaleString()} ft` : '—'],
      ['SPEED', f.speed ? `${f.speed} kts` : '—'],
      ['HEADING', f.heading != null ? `${f.heading}°` : '—'],
      ['SQUAWK', f.squawk || '—'],
      ['POSITION', `${Math.abs(f.lat).toFixed(4)}°${f.lat>=0?'N':'S'}  ${Math.abs(f.lon).toFixed(4)}°${f.lon>=0?'E':'W'}`],
    ]
    if (f.anomaly) {
      alertBlock = {
        severity: f.severity,
        headline: f.anomaly_reason,
        detail: squawkMeaning
          ? `Squawk ${f.squawk} indicates: ${squawkMeaning}. ATC has been notified. Aircraft may be declaring an emergency or under duress.`
          : f.severity === 'HIGH'
            ? 'This aircraft is broadcasting an emergency transponder code. Military and civilian ATC are monitoring. Intercept protocols may be active.'
            : 'Unusual flight parameters detected. This aircraft is deviating from expected behavior patterns.',
      }
    }
  } else if (type === 'ship') {
    const s = data
    title = `⛴ ${s.name || s.id}`
    subtitle = `${s.flag || ''} · ${s.type || 'Vessel'}`
    rows = [
      ['MMSI', s.id],
      ['TYPE', s.type || '—'],
      ['FLAG', s.flag || '—'],
      ['SPEED', s.speed ? `${s.speed} kts` : '—'],
      ['HEADING', s.heading != null ? `${s.heading}°` : '—'],
      ['AIS GAP', s.ais_gap_hours > 0 ? `${s.ais_gap_hours}h dark` : 'Transmitting'],
      ['LAST SEEN', s.last_seen ? new Date(s.last_seen).toLocaleTimeString('en-US', {hour12:false}) + ' UTC' : '—'],
      ['POSITION', `${Math.abs(s.lat).toFixed(4)}°${s.lat>=0?'N':'S'}  ${Math.abs(s.lon).toFixed(4)}°${s.lon>=0?'E':'W'}`],
    ]
    if (s.anomaly) {
      alertBlock = {
        severity: s.severity,
        headline: s.anomaly_reason,
        detail: s.ais_gap_hours > 6
          ? `Vessel has not transmitted AIS for ${s.ais_gap_hours} hours. Vessels may disable AIS to avoid detection during smuggling, sanctions evasion, or illegal fishing. Last known position logged.`
          : `Vessel speed of ${s.speed} kts exceeds normal operating parameters. Most cargo vessels cruise at 12–18 kts. This may indicate evasive maneuvering or erroneous data.`,
      }
    }
  } else if (type === 'event') {
    const ev = data
    const fatalityLevel = ev.fatalities >= 20 ? 'HIGH' : ev.fatalities >= 5 ? 'MEDIUM' : 'LOW'
    title = `⚠ ${ev.type}`
    subtitle = `${ev.country} · ${ev.date}`
    rows = [
      ['COUNTRY', ev.country],
      ['DATE', ev.date],
      ['FATALITIES', ev.fatalities > 0 ? `${ev.fatalities} confirmed` : 'None reported'],
      ['POSITION', `${Math.abs(ev.lat).toFixed(4)}°${ev.lat>=0?'N':'S'}  ${Math.abs(ev.lon).toFixed(4)}°${ev.lon>=0?'E':'W'}`],
    ]
    descBlock = ev.description
    alertBlock = {
      severity: fatalityLevel,
      headline: `${ev.type} — ${ev.country}`,
      detail: ev.fatalities > 0
        ? `${ev.fatalities} fatalities reported. Source: ACLED conflict monitoring dataset.`
        : 'No fatalities reported. Event logged for situational awareness.',
    }
  }

  const severityColors = {
    HIGH:   { border: '#ef4444', bg: 'rgba(239,68,68,0.08)', text: '#ef4444' },
    MEDIUM: { border: '#eab308', bg: 'rgba(234,179,8,0.08)',  text: '#eab308' },
    LOW:    { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',  text: '#22c55e' },
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <div>
          <div className="detail-panel__title">{title}</div>
          {subtitle && <div className="detail-panel__subtitle">{subtitle}</div>}
        </div>
        <button className="detail-panel__close" onClick={onClose}>✕</button>
      </div>

      {alertBlock && (() => {
        const c = severityColors[alertBlock.severity] || severityColors.LOW
        return (
          <div style={{
            margin: '10px 0',
            padding: '10px 12px',
            borderLeft: `3px solid ${c.border}`,
            background: c.bg,
            borderRadius: '0 4px 4px 0',
          }}>
            <div style={{ color: c.text, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', marginBottom: 4 }}>
              {alertBlock.severity} ALERT — {alertBlock.headline}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6 }}>
              {alertBlock.detail}
            </div>
          </div>
        )
      })()}

      <div style={{ marginTop: 8 }}>
        {rows.map(([key, val]) => (
          <div key={key} className="detail-panel__row">
            <span className="detail-panel__key">{key}</span>
            <span className="detail-panel__val">{val}</span>
          </div>
        ))}
      </div>

      {descBlock && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
          {descBlock}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [flights, setFlights] = useState([])
  const [ships, setShips]     = useState([])
  const [events, setEvents]   = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [online, setOnline]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [visible, setVisible] = useState({
    flights: true,
    ships: true,
    events: true,
  })

  const [viewState, setViewState] = useState({
    longitude: 15,
    latitude: 30,
    zoom: 2.2,
    pitch: 0,
    bearing: 0,
  })

  const flyTo = useCallback((lon, lat, zoom = 6) => {
    setViewState(vs => ({
      ...vs,
      longitude: lon,
      latitude: lat,
      zoom,
      transitionDuration: 1200,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.5 }),
    }))
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [f, s, ev, an, st] = await Promise.all([
        fetch(`${API}/api/flights`).then(r => r.json()),
        fetch(`${API}/api/ships`).then(r => r.json()),
        fetch(`${API}/api/events`).then(r => r.json()),
        fetch(`${API}/api/anomalies`).then(r => r.json()),
        fetch(`${API}/api/stats`).then(r => r.json()),
      ])
      setFlights(Array.isArray(f) ? f : [])
      setShips(Array.isArray(s) ? s : [])
      setEvents(Array.isArray(ev) ? ev : [])
      setAnomalies(Array.isArray(an) ? an : [])
      setStats(st)
      setOnline(true)
      setLoading(false)
    } catch (err) {
      console.error('API fetch failed:', err)
      setOnline(false)
      setLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchAll])

  const handleToggleLayer = useCallback((key) => {
    setVisible(v => ({ ...v, [key]: !v[key] }))
  }, [])

  const handleAnomalyClick = useCallback((anomaly) => {
    const type = anomaly.entity_type === 'FLIGHT' ? 'flight' : 'ship'
    if (type === 'flight') {
      const f = flights.find(x => x.id === anomaly.entity_id)
      if (f) {
        setSelected({ type: 'flight', data: f })
        flyTo(f.lon, f.lat, 6)
      }
    } else {
      const s = ships.find(x => x.id === anomaly.entity_id)
      if (s) {
        setSelected({ type: 'ship', data: s })
        flyTo(s.lon, s.lat, 5)
      }
    }
  }, [flights, ships, flyTo])

  const handleEventClick = useCallback((ev) => {
    setSelected({ type: 'event', data: ev })
    flyTo(ev.lon, ev.lat, 5)
  }, [flyTo])

  const handleSelectEntity = useCallback((entity) => {
    setSelected(entity)
    const d = entity.data
    if (d?.lon != null && d?.lat != null) flyTo(d.lon, d.lat, 6)
  }, [flyTo])

  const flightAnomalyCount = flights.filter(f => f.anomaly).length
  const shipAnomalyCount = ships.filter(s => s.anomaly).length
  const totalAnomalies = flightAnomalyCount + shipAnomalyCount
  const highSeverity = anomalies.filter(a => a.severity === 'HIGH').length

  return (
    <div className="app-shell">
      {/* Scanline CRT overlay */}
      <div className="scanlines" aria-hidden="true" />

      {/* ── Top Bar ─────────────────────── */}
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo">🛰</div>
          <div>
            <div className="topbar__title">GEOINT Dashboard</div>
            <div className="topbar__subtitle">Live Global Intelligence</div>
          </div>
        </div>

        <div className="topbar__stats">
          <StatChip
            icon="✈"
            label="Aircraft"
            value={flights.length.toLocaleString()}
          />
          <StatChip
            icon="⛴"
            label="Vessels"
            value={ships.length.toLocaleString()}
          />
          <StatChip
            icon="⚠"
            label="Incidents"
            value={events.length}
          />
          <StatChip
            icon="🔴"
            label="Anomalies"
            value={totalAnomalies}
            variant={totalAnomalies > 0 ? 'alert' : 'ok'}
          />
          {highSeverity > 0 && (
            <StatChip
              icon="⚡"
              label="High"
              value={highSeverity}
              variant="alert"
            />
          )}
        </div>

        <div className="topbar__right">
          <span className="topbar__time">
            {stats?.last_update ? formatLastUpdate(stats.last_update) : 'Connecting...'}
          </span>
          <div className={`status-dot ${online ? '' : 'status-dot--offline'}`} />
        </div>
      </header>

      {/* ── Map ─────────────────────────── */}
      <main className="map-wrapper">
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <div className="loading-text">Acquiring data feeds…</div>
          </div>
        ) : (
          <>
            <MapView
              flights={flights}
              ships={ships}
              events={events}
              visible={visible}
              onSelectEntity={handleSelectEntity}
              viewState={viewState}
              onViewStateChange={setViewState}
            />
            <LayerControls
              visible={visible}
              onChange={handleToggleLayer}
              counts={{
                flights: flights.length,
                ships: ships.length,
                events: events.length,
              }}
            />
            <div className="map-legend">
              <div className="map-legend__title">Legend</div>
              <div className="legend-item">
                <span className="legend-item__dot" style={{ background: '#3b82f6' }} />
                <span className="legend-item__label">Aircraft (normal)</span>
              </div>
              <div className="legend-item">
                <span className="legend-item__dot" style={{ background: '#eab308' }} />
                <span className="legend-item__label">Aircraft (medium alert)</span>
              </div>
              <div className="legend-item">
                <span className="legend-item__dot" style={{ background: '#ef4444' }} />
                <span className="legend-item__label">Aircraft (emergency)</span>
              </div>
              <div className="legend-item">
                <span className="legend-item__dot" style={{ background: '#14b8a6' }} />
                <span className="legend-item__label">Vessel (normal)</span>
              </div>
              <div className="legend-item">
                <span className="legend-item__dot" style={{ background: '#ef4444', opacity: 0.8 }} />
                <span className="legend-item__label">Vessel anomaly / AIS dark</span>
              </div>
              <div className="legend-item">
                <span className="legend-item__dot" style={{ background: '#fb923c' }} />
                <span className="legend-item__label">Conflict event</span>
              </div>
            </div>
            {selected && (
              <DetailPanel
                selected={selected}
                onClose={() => setSelected(null)}
              />
            )}
          </>
        )}
      </main>

      {/* ── Sidebar ─────────────────────── */}
      <Sidebar
        anomalies={anomalies}
        events={events}
        onAnomalyClick={handleAnomalyClick}
        onEventClick={handleEventClick}
      />
    </div>
  )
}
