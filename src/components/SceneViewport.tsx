import type { RefObject } from 'react';
import type { LightMode } from '../engine/Renderer';
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
};

const lightIcons: Record<LightMode, string> = {
  sun: sunIcon,
  spot: spotIcon,
  top: topIcon
};

export function SceneViewport({ canvasRef, lightsScreen, error }: Props) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

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
            left: 12,
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
