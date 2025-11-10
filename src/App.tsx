import { useEffect, useRef, useState } from 'react';
import { Renderer } from './engine/Renderer';
import { ControlPanel, type ShadowParams } from './components/ControlPanel';

export default function App() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        if (!ref.current) return;
        const renderer = new Renderer(ref.current);
        await renderer.init();
        renderer.setFpsCallback(setFps);
        renderer.start();
        rendererRef.current = renderer;
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    })();

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, []);

  const handleParamsChange = (params: ShadowParams) => {
    if (rendererRef.current) {
      rendererRef.current.updateShadowParams(params);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#14161a', color: '#e6e6e6' }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
      <ControlPanel onParamsChange={handleParamsChange} fps={fps} />
      {error && (
        <div style={{ position: 'absolute', top: 12, left: 12, padding: 8, background: '#2b2f36', borderRadius: 6, maxWidth: 420 }}>
          <b>Ошибка WebGPU:</b> {error}
        </div>
      )}
    </div>
  );
}
