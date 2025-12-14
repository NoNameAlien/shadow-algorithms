import { useEffect, useRef, useState } from 'react';
import { Renderer } from './engine/Renderer';
import { ControlPanel, type ShadowParams } from './components/ControlPanel';
import type { LightMode } from './engine/Renderer';

export default function App() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [lightMode, setLightMode] = useState<LightMode>('sun');
  type Lang = 'en' | 'ru';
  const [lang, setLang] = useState<Lang>('ru');


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

    const checkPointerLock = setInterval(() => {
      if (rendererRef.current?.cameraController) {
        setIsPointerLocked(rendererRef.current.cameraController.isLocked());
      }
    }, 100);

    return () => {
      clearInterval(checkPointerLock);
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

  const handleLoadModel = async (file: File) => {
    if (rendererRef.current) {
      await rendererRef.current.loadModel(file);
    }
  };

  const handleResetModel = () => {
    if (rendererRef.current) {
      rendererRef.current.resetModel();
    }
  };

  const handleResetScene = () => {
    if (rendererRef.current) {
      rendererRef.current.resetScene();
    }
  };

  const handleLightModeChange = (mode: LightMode) => {
    setLightMode(mode);
    if (rendererRef.current) {
      rendererRef.current.setLightMode(mode);
    }
  };

  const handleLoadObjectTexture = (file: File) => {
    rendererRef.current?.loadObjectTexture(file);
  };

  const handleLoadFloorTexture = (file: File) => {
    rendererRef.current?.loadFloorTexture(file);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#14161a', color: '#e6e6e6' }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
      <ControlPanel
        onParamsChange={handleParamsChange}
        onLoadModel={handleLoadModel}
        onResetScene={handleResetScene}
        onResetModel={handleResetModel}
        isPointerLocked={isPointerLocked}
        fps={fps}
        lightMode={lightMode}
        onLightModeChange={handleLightModeChange}
        onLoadObjectTexture={handleLoadObjectTexture}
        onLoadFloorTexture={handleLoadFloorTexture}
        lang={lang}
        onLanguageChange={setLang}
      />
      {error && (
        <div style={{ position: 'absolute', top: 12, left: 12, padding: 8, background: '#2b2f36', borderRadius: 6, maxWidth: 420 }}>
          <b>Ошибка WebGPU:</b> {error}
        </div>
      )}
    </div>
  );
}
