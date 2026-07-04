import type { CSSProperties } from 'react'

export const colors = {
  textPrimary: '#111',
  textSecondary: '#6b6b6b',
  border: '#eee',
}

export const headerColors = {
  navy: '#1a1a2e',
  green: '#1a3a2e',
  night: '#0d0d1a',
}

export const badge = {
  red: { background: '#FCEBEB', color: '#A32D2D', accent: '#E24B4A' },
  amber: { background: '#FAEEDA', color: '#854F0B', accent: '#BA7517' },
  blue: { background: '#E6F1FB', color: '#185FA5', accent: '#185FA5' },
  green: { background: '#E1F5EE', color: '#0F6E56', accent: '#0F6E56' },
}

export const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: '0 0 8px',
}

export const cardStyle: CSSProperties = {
  background: 'white',
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: '12px 14px',
  marginBottom: 8,
}
