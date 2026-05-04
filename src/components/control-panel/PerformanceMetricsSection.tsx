import { useState } from 'react';
import type { ControlPanelStrings, Lang, PerformanceMetrics } from './types';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  metrics?: PerformanceMetrics;
  floating?: boolean;
  onReset?: () => void;
};

const EMPTY_METRICS: PerformanceMetrics = {
  fps: 0,
  averageFps: 0,
  recentMinFps: 0,
  recentMaxFps: 0,
  sessionMinFps: 0,
  sessionMaxFps: 0,
  frameTimeMs: 0,
  averageFrameTimeMs: 0,
  maxFrameTimeMs: 0,
  frameTimeHistory: [],
  sampleDurationMs: 0
};

const metricBoxStyle = {
  padding: '6px 8px',
  background: '#202531',
  border: '1px solid #343b4a',
  borderRadius: 6
};

export function PerformanceMetricsSection({
  lang,
  strings,
  metrics = EMPTY_METRICS,
  floating = false,
  onReset
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const history = metrics.frameTimeHistory.slice(-60);
  const graphMax = Math.max(33.3, ...history);

  return (
    <div
      style={{
        padding: 10,
        marginBottom: floating ? 0 : 8,
        background: floating ? 'rgba(20, 22, 26, 0.88)' : '#1a1d23',
        border: '1px solid #303641',
        borderRadius: 6,
        boxShadow: floating ? '0 8px 24px rgba(0, 0, 0, 0.28)' : undefined,
        backdropFilter: floating ? 'blur(8px)' : undefined,
        width: floating ? 280 : undefined
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: collapsed ? 0 : 8
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((previous) => !previous)}
          title={collapsed ? (lang === 'ru' ? 'Развернуть' : 'Expand') : lang === 'ru' ? 'Свернуть' : 'Collapse'}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: 0,
            background: 'transparent',
            color: '#e6e6e6',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'left'
          }}
        >
          <span>{lang === 'ru' ? 'Метрики производительности' : 'Performance metrics'}</span>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{collapsed ? '+' : '-'}</span>
        </button>

        {!collapsed && (
          <button
            type="button"
            onClick={onReset}
            disabled={!onReset}
            style={{
              padding: '3px 6px',
              background: '#343b4a',
              color: '#e6e6e6',
              border: '1px solid #485163',
              borderRadius: 4,
              cursor: onReset ? 'pointer' : 'default',
              fontSize: 11
            }}
          >
            {lang === 'ru' ? 'Сброс' : 'Reset'}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              marginBottom: 8,
              fontSize: 12
            }}
          >
            <div style={metricBoxStyle}>
              <div style={{ opacity: 0.65 }}>{strings.fpsLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{metrics.fps}</div>
            </div>
            <div style={metricBoxStyle}>
              <div style={{ opacity: 0.65 }}>{lang === 'ru' ? 'Frame time' : 'Frame time'}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{metrics.frameTimeMs.toFixed(1)} ms</div>
            </div>
            <div style={metricBoxStyle}>
              <div style={{ opacity: 0.65 }}>{lang === 'ru' ? 'Средний FPS за сессию' : 'Session avg FPS'}</div>
              <div style={{ fontWeight: 700 }}>{metrics.averageFps}</div>
            </div>
            <div style={metricBoxStyle}>
              <div style={{ opacity: 0.65 }}>{lang === 'ru' ? 'FPS сессии min/max' : 'Session min/max FPS'}</div>
              <div style={{ fontWeight: 700 }}>
                {metrics.sessionMinFps} / {metrics.sessionMaxFps}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 6, fontSize: 12, opacity: 0.68 }}>
            {lang === 'ru' ? 'Recent min/max FPS' : 'Recent min/max FPS'}: {metrics.recentMinFps} /{' '}
            {metrics.recentMaxFps}
            {metrics.sampleDurationMs > 0 ? ` · ${Math.round(metrics.sampleDurationMs)} ms sample` : ''}
          </div>

          <div
            style={{
              height: 46,
              display: 'flex',
              alignItems: 'end',
              gap: 2,
              padding: '4px 0',
              borderTop: '1px solid #262a32',
              borderBottom: '1px solid #262a32'
            }}
            aria-label={lang === 'ru' ? 'История времени кадра' : 'Frame time history'}
          >
            {history.map((frameTime, index) => {
              const height = Math.max(2, Math.min(38, (frameTime / graphMax) * 38));
              const color = frameTime <= 16.7 ? '#51cf66' : frameTime <= 33.3 ? '#fcc419' : '#ff6b6b';

              return (
                <div
                  key={`${index}-${frameTime.toFixed(2)}`}
                  title={`${frameTime.toFixed(1)} ms`}
                  style={{
                    flex: 1,
                    minWidth: 1,
                    height,
                    background: color,
                    borderRadius: 2
                  }}
                />
              );
            })}
          </div>

          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.68 }}>
            {lang === 'ru' ? 'Frame avg' : 'Frame avg'}: {metrics.averageFrameTimeMs.toFixed(1)} ms ·{' '}
            {lang === 'ru' ? 'Frame max' : 'Frame max'}: {metrics.maxFrameTimeMs.toFixed(1)} ms
          </div>
        </>
      )}
    </div>
  );
}
