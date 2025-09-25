import { useEffect, useRef, useState } from 'react';
import { Renderer } from './engine/Renderer';

export default function App() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let renderer: Renderer | null = null;
    (async () => {
      try {
        if (!ref.current) return;
        renderer = new Renderer(ref.current);
        await renderer.init();
        renderer.start();
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    })();
    return () => renderer?.stop();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#14161a', color: '#e6e6e6' }}>
      <canvas
        ref={ref}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {error && (
        <div style={{
          position: 'absolute', top: 12, left: 12, padding: 8,
          background: '#2b2f36', borderRadius: 6, maxWidth: 420
        }}>
          <b>Ошибка WebGPU:</b> {error}
        </div>
      )}
    </div>
  );
}
