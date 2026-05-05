import { useState, type ReactNode } from 'react';
import { sectionStyle } from './styles';

type Props = {
  children: ReactNode;
  title?: string;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  right?: ReactNode;
};

export function PanelSection({ children, title, defaultCollapsed = false, collapsible = true, right }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsible && collapsed;

  return (
    <div style={sectionStyle}>
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: isCollapsed ? 0 : 8,
            minHeight: 22
          }}
        >
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
            {title}
          </div>
          {right}
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((previous) => !previous)}
              title={collapsed ? 'Expand' : 'Collapse'}
              style={{
                width: 24,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#252a34',
                color: '#e6e6e6',
                border: '1px solid #343b4a',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                flexShrink: 0
              }}
            >
              {collapsed ? '▾' : '▴'}
            </button>
          ) : null}
        </div>
      )}
      {!isCollapsed && children}
    </div>
  );
}
