import type { RefObject } from 'react';
import type { LightMode, ShadowDebugMode, ShadowMethod } from '../engine/Renderer';
import { PerformanceMetricsSection } from './control-panel/PerformanceMetricsSection';
import { STRINGS } from './control-panel/constants';
import type { Lang, PerformanceMetrics } from './control-panel/types';
import sunIcon from '../image/light/sun.png';
import spotIcon from '../image/light/spot.png';
import topIcon from '../image/light/top.png';

export type LightScreenPosition = {
  x: number;
  y: number;
  visible: boolean;
  mode: LightMode;
  active: boolean;
};

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  lightsScreen: LightScreenPosition[];
  error: string | null;
  lang: Lang;
  performanceMetrics: PerformanceMetrics;
  onResetPerformanceMetrics: () => void;
  shadowDebugMode: ShadowDebugMode;
  shadowMethod: ShadowMethod;
};

const lightIcons: Record<LightMode, string> = {
  sun: sunIcon,
  spot: spotIcon,
  top: topIcon
};

export function SceneViewport({
  canvasRef,
  lightsScreen,
  error,
  lang,
  performanceMetrics,
  onResetPerformanceMetrics,
  shadowDebugMode,
  shadowMethod
}: Props) {
  const strings = STRINGS[lang];
  const debugLabel = shadowMethod === 'VSM'
    ? 'VSM moments'
    : shadowDebugMode === 'secondary'
      ? 'Secondary depth'
      : 'Primary depth';

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
        <PerformanceMetricsSection
          lang={lang}
          strings={strings}
          metrics={performanceMetrics}
          floating
          onReset={onResetPerformanceMetrics}
        />
      </div>

      {shadowDebugMode !== 'off' && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 3,
            width: 220,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              padding: '5px 8px',
              background: 'rgba(20, 22, 26, 0.86)',
              border: '1px solid #485163',
              borderBottom: 'none',
              borderRadius: '6px 6px 0 0',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {lang === 'ru' ? 'Shadow Map' : 'Shadow Map'}: {debugLabel}
          </div>
          <div
            style={{
              height: 220,
              border: '1px solid #485163',
              borderRadius: '0 0 6px 6px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)'
            }}
          />
        </div>
      )}

      {lightsScreen.map((light, index) =>
        light.visible ? (
          <img
            key={index}
            src={lightIcons[light.mode]}
            alt={light.mode}
            style={{
              position: 'absolute',
              left: light.x - 16,
              top: light.y - 16,
              width: light.active ? 32 : 24,
              height: light.active ? 32 : 24,
              opacity: light.active ? 1.0 : 0.7,
              pointerEvents: 'none'
            }}
          />
        ) : null
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 308,
            padding: 8,
            background: '#2b2f36',
            borderRadius: 6,
            maxWidth: 420
          }}
        >
          <b>Ошибка WebGPU:</b> {error}
        </div>
      )}
    </div>
  );
}
