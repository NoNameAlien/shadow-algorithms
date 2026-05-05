import type { CSSProperties } from 'react';

export const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  background: '#181b20',
  padding: 12,
  borderRadius: 0,
  width: 340,
  minWidth: 340,
  maxWidth: 340,
  maxHeight: '100vh',
  overflowY: 'auto',
  overflowX: 'hidden',
  color: '#e6e6e6',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 14,
  boxSizing: 'border-box',
  boxShadow: '-10px 0 30px rgba(0,0,0,0.34)',
  borderLeft: '1px solid #262a32'
};

export const sectionStyle: CSSProperties = {
  padding: 10,
  borderRadius: 6,
  background: '#1e222b',
  border: '1px solid #262a32',
  marginBottom: 8,
  boxSizing: 'border-box',
  minWidth: 0,
  overflow: 'hidden'
};

export const buttonStyle: CSSProperties = {
  padding: '4px 7px',
  fontSize: 12,
  borderRadius: 5,
  border: '1px solid #343b4a',
  color: '#e6e6e6',
  cursor: 'pointer'
};

export const selectStyle: CSSProperties = {
  width: '100%',
  display: 'block',
  marginTop: 4,
  padding: 4,
  background: '#252a34',
  color: '#e6e6e6',
  border: '1px solid #343b4a',
  borderRadius: 4,
  fontSize: 14
};

export const subtleButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#252a34'
};

export const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#2f5fd7',
  border: '1px solid #4568d9',
  color: '#fff',
  fontWeight: 600
};

export const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#8f2f2f',
  border: '1px solid #a84646',
  color: '#fff',
  fontWeight: 600
};

export const fileButtonStyle: CSSProperties = {
  padding: '4px 8px',
  fontSize: 13,
  background: '#252a34',
  color: '#e6e6e6',
  border: '1px solid #343b4a',
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

export const colorInputStyle: CSSProperties = {
  width: 34,
  height: 24,
  padding: 1,
  border: '1px solid #343b4a',
  borderRadius: 4,
  background: '#252a34',
  flexShrink: 0,
  cursor: 'pointer'
};
