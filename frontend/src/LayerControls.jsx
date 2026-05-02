import React from 'react'

const LAYERS = [
  { key: 'flights', label: 'Aircraft', color: '#3b82f6', icon: '✈' },
  { key: 'ships',   label: 'Vessels',  color: '#14b8a6', icon: '⛴' },
  { key: 'events',  label: 'Incidents', color: '#ef4444', icon: '⚠' },
]

export default function LayerControls({ visible, onChange, counts }) {
  return (
    <div className="layer-controls">
      <div className="layer-controls__title">Map Layers</div>
      {LAYERS.map(({ key, label, color, icon }) => (
        <label key={key} className="layer-toggle">
          <input
            type="checkbox"
            checked={visible[key]}
            onChange={() => onChange(key)}
          />
          <span
            className="layer-toggle__dot"
            style={{
              background: color,
              boxShadow: `0 0 6px ${color}88`,
            }}
          />
          <span className="layer-toggle__label">
            {icon} {label}
          </span>
          <span className="layer-toggle__count">
            {counts?.[key] ?? '—'}
          </span>
        </label>
      ))}
    </div>
  )
}
