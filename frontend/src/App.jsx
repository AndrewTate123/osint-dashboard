import React, { useState, useEffect, useCallback, useRef } from 'react'
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

function DetailPanel({ selected, onClose }) {
  if (!selected) return null
  const { type, data } = selected

  let title = ''
  let rows = []
  let anomalyFlag = null

  if (type === 'flight') {
    const f = data
    title = `✈ ${f.callsign || f.id}`
    rows = [
      ['ICAO24', f.id],
      ['COUNTRY', f.country || '—'],
      ['ALTITUDE', f.altitude ? `${f.altitude.toLocaleString()} ft` : '—'],
      ['SPEED', f.speed ? `${f.speed} kts` : '—'],
      ['HEADING', f.heading != null ? `${f.heading}°` : '—'],
      ['SQUAWK', f.squawk || '—'],
      ['POSITION', `${Math.abs(f.lat).toFixed(3)}°${f.lat>=0?'N':'S'} ${Math.abs(f.lon).toFixed(3)}°${f.lon>=0?'E':'W'}`],
    ]
    if (f.anomaly) {
      anomalyFlag = { text: f.anomaly_reason, severity: f.severity }
    }
  } else if (type === 'ship') {
    const s = data
    title = `⛴ ${s.name || s.id}`
    rows = [
      ['MMSI', s.id],
      ['TYPE', s.type || '—'],
      ['FLAG', s.flag || '—'],
      ['SPEED', s.speed ? `${s.speed} kts` : '—'],
      ['HEADING', s.heading != null ? `${s.heading}°` : '—'],
      ['AIS GAP', s.ais_gap_hours > 0 ? `${s.ais_gap_hours}h` : 'Current'],
      ['LAST SEEN', s.last_seen ? new Date(s.last_seen).toLocaleTimeString('en-US', {hour12:false}) + ' UTC' : '—'],
      ['POSITION', `${Math.abs(s.lat).toFixed(3)}°${s.lat>=0?'N':'S'} ${Math.abs(s.lon).toFixed(3)}°${s.lon>=0?'E':'W'}`],
    ]
    if (s.anomaly) {
      anomalyFlag = { text: s.anomaly_reason, severity: s.severity }
    }
  } else if (type === 'event') {
    const ev = data
    title = `⚠ ${ev.type}`
    rows = [
      ['COUNTRY', ev.country],
      ['DATE', ev.date],
      ['FATALITIES', String(ev.fatalities)],
      ['POSITION', `${Math.abs(ev.lat).toFixed(3)}°${ev.lat>=0?'N':'S'} ${Math.abs(ev.lon).toFixed(3)}°${ev.lon>=0?'E':'W'}`],
    ]
    anomalyFlag = { text: ev.description, severity: 'MEDIUM' }
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <span className="detail-panel__title">{title}</span>
        <button className="detail-panel__close" onClick={onClose}>✕</button>
      </div>
      {rows.map(([key, val]) => (
        <div key={key} className="detail-panel__row">
          <span className="detail-panel__key">{key}</span>
          <span className="detail-panel__val">{val}</span>
        </div>
      ))}
      {anomalyFlag && (
        <div className={`detail-panel__anomaly-flag detail-panel__anomaly-flag--${anomalyFlag.severity}`}>
          {anomalyFlag.text}
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
    // Find the underlying entity
    const type = anomaly.entity_type === 'FLIGHT' ? 'flight' : 'ship'
    if (type === 'flight') {
      const f = flights.find(x => x.id === anomaly.entity_id)
      if (f) setSelected({ type: 'flight', data: f })
    } else {
      const s = ships.find(x => x.id === anomaly.entity_id)
      if (s) setSelected({ type: 'ship', data: s })
    }
  }, [flights, ships])

  const handleEventClick = useCallback((ev) => {
    setSelected({ type: 'event', data: ev })
  }, [])

  const handleSelectEntity = useCallback((entity) => {
    setSelected(entity)
  }, [])

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
