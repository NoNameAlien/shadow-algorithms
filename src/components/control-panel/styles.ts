import type { CSSProperties } from 'react';

export const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  background: '#181b20',
  padding: 14,
  borderRadius: 10,
  minWidth: 280,
  maxWidth: 340,
  maxHeight: 'calc(100vh - 24px)',
  overflowY: 'auto',
  color: '#e6e6e6',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 14,
  boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
  border: '1px solid #262a32'
};

export const sectionStyle: CSSProperties = {
  padding: 10,
  borderRadius: 8,
  background: '#1e222b',
  border: '1px solid #262a32',
  marginBottom: 10
};

export const buttonStyle: CSSProperties = {
  padding: '3px 6px',
  fontSize: 12,
  borderRadius: 6,
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
  width: 32,
  height: 20,
  padding: 0,
  border: 'none',
  cursor: 'pointer'
};
