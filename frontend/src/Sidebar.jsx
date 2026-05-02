import React, { useState } from 'react'

function formatTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' UTC'
}

function formatCoord(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
  const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
  return `${latStr} ${lonStr}`
}

function AnomalyCard({ anomaly, onClick }) {
  return (
    <div
      className={`anomaly-card anomaly-card--${anomaly.severity}`}
      onClick={() => onClick && onClick(anomaly)}
    >
      <div className="anomaly-card__header">
        <span className={`anomaly-card__type-badge anomaly-card__type-badge--${anomaly.entity_type}`}>
          {anomaly.entity_type === 'FLIGHT' ? '✈ FLIGHT' : '⛴ VESSEL'}
        </span>
        <span className={`anomaly-card__severity anomaly-card__severity--${anomaly.severity}`}>
          {anomaly.severity}
        </span>
      </div>
      <div className="anomaly-card__name">{anomaly.entity_name}</div>
      <div className="anomaly-card__reason">{anomaly.reason}</div>
      <div className="anomaly-card__meta">
        <span className="anomaly-card__coord">
          {formatCoord(anomaly.lat, anomaly.lon)}
        </span>
        <span className="anomaly-card__time">
          {formatTime(anomaly.timestamp)}
        </span>
      </div>
    </div>
  )
}

function EventCard({ event, onClick }) {
  const fatalityText = event.fatalities > 0
    ? `${event.fatalities} KIA`
    : 'No KIA'

  return (
    <div className="event-card" onClick={() => onClick && onClick(event)}>
      <div className="event-card__header">
        <span className="event-card__type">{event.type}</span>
        <span className="event-card__country">{event.country}</span>
      </div>
      <div className="event-card__desc">{event.description}</div>
      <div className="event-card__footer">
        <span className="event-card__date">{event.date}</span>
        <span className="event-card__fatalities">{fatalityText}</span>
      </div>
    </div>
  )
}

export default function Sidebar({ anomalies, events, onAnomalyClick, onEventClick }) {
  const [eventsExpanded, setEventsExpanded] = useState(true)

  const highCount = anomalies.filter(a => a.severity === 'HIGH').length
  const mediumCount = anomalies.filter(a => a.severity === 'MEDIUM').length

  // Sort: HIGH first, then MEDIUM
  const sorted = [...anomalies].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 }
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
  })

  return (
    <aside className="sidebar">
      {/* Anomaly Feed Header */}
      <div className="sidebar__header">
        <span className="sidebar__title">⚡ Anomaly Feed</span>
        <span className="sidebar__badge">
          {highCount > 0 ? `${highCount} HIGH` : mediumCount > 0 ? `${mediumCount} MED` : '0'}
        </span>
      </div>

      {/* Anomaly Feed */}
      <div className="anomaly-feed">
        {sorted.length === 0 ? (
          <div className="no-anomalies">
            <span style={{ fontSize: 24 }}>🛡</span>
            <span>No anomalies detected</span>
          </div>
        ) : (
          sorted.map(a => (
            <AnomalyCard
              key={a.id}
              anomaly={a}
              onClick={onAnomalyClick}
            />
          ))
        )}
      </div>

      {/* Conflict Events Panel */}
      <div className="sidebar__section">
        <div
          className="sidebar__section-header"
          onClick={() => setEventsExpanded(v => !v)}
        >
          <span className={`sidebar__section-title ${eventsExpanded ? 'sidebar__section-title--active' : ''}`}>
            🌍 Conflict Events ({events.length})
          </span>
          <span className={`sidebar__chevron ${eventsExpanded ? 'sidebar__chevron--open' : ''}`}>
            ▲
          </span>
        </div>
        {eventsExpanded && (
          <div className="event-list">
            {events.map(ev => (
              <EventCard
                key={ev.id}
                event={ev}
                onClick={onEventClick}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
