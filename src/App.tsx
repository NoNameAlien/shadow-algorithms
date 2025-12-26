import { useEffect, useRef, useState } from 'react';
import { Renderer } from './engine/Renderer';
import { ControlPanel, type ShadowParams } from './components/ControlPanel';
import type { LightMode } from './engine/Renderer';
import sunIcon from './image/light/sun.png';
import spotIcon from './image/light/spot.png';
import topIcon from './image/light/top.png';

export default function App() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [lightMode, setLightMode] = useState<LightMode>('sun');
  type Lang = 'en' | 'ru';
  const [lang, setLang] = useState<Lang>('ru');
  const [autoRotate, setAutoRotate] = useState(true);
  const [objectMoveSpeed, setObjectMoveSpeed] = useState(1.0);
  const [lightIntensity, setLightIntensity] = useState(1.0);
  const [showLightBeam, setShowLightBeam] = useState(true);

  const [showFloor, setShowFloor] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [floorColor, setFloorColor] = useState('#26282d');
  const [wallColor, setWallColor] = useState('#1f2226');

  const [lightScreenPos, setLightScreenPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false
  });

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

  useEffect(() => {
    let frameId: number;

    const loop = () => {
      const r = rendererRef.current;
      if (r) {
        const pos = r.getLightScreenPosition();
        setLightScreenPos(pos);
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const hexToRgb01 = (hex: string): [number, number, number] => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return [0.2, 0.2, 0.2];
    const intVal = parseInt(m[1], 16);
    const r = ((intVal >> 16) & 255) / 255;
    const g = ((intVal >> 8) & 255) / 255;
    const b = (intVal & 255) / 255;
    return [r, g, b];
  };

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

  const handleToggleAutoRotate = () => {
    setAutoRotate((prev) => {
      const next = !prev;
      rendererRef.current?.setObjectAutoRotate(next);
      return next;
    });
  };

  const handleObjectMoveSpeedChange = (value: number) => {
    setObjectMoveSpeed(value);
    rendererRef.current?.setObjectMoveSpeed(value);
  };

  const handleLightIntensityChange = (value: number) => {
    setLightIntensity(value);
    rendererRef.current?.setLightIntensity(value);
  };

  const handleShowLightBeamChange = (value: boolean) => {
    setShowLightBeam(value);
    rendererRef.current?.setShowLightBeam(value);
  };

  const handleLoadObjectTexture = (file: File) => {
    rendererRef.current?.loadObjectTexture(file);
  };

  const handleLoadFloorTexture = (file: File) => {
    rendererRef.current?.loadFloorTexture(file);
  };

  const handleShowFloorChange = (value: boolean) => {
    setShowFloor(value);
    rendererRef.current?.setFloorVisible(value);
  };

  const handleShowWallsChange = (value: boolean) => {
    setShowWalls(value);
    rendererRef.current?.setWallsVisible(value);
  };

  const handleFloorColorChange = (hex: string) => {
    setFloorColor(hex);
    rendererRef.current?.setFloorColor(hexToRgb01(hex));
  };

  const handleWallColorChange = (hex: string) => {
    setWallColor(hex);
    rendererRef.current?.setWallColor(hexToRgb01(hex));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#14161a', color: '#e6e6e6' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <canvas
          ref={ref}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Иконка источника света поверх canvas */}
        {lightScreenPos.visible && (
          <img
            src={
              lightMode === 'sun'
                ? sunIcon
                : lightMode === 'spot'
                  ? spotIcon
                  : topIcon
            }
            alt={lightMode}
            style={{
              position: 'absolute',
              left: lightScreenPos.x - 16,
              top: lightScreenPos.y - 16,
              width: 32,
              height: 32,
              pointerEvents: 'none', 
            }}
          />
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
        autoRotate={autoRotate}
        onToggleAutoRotate={handleToggleAutoRotate}
        showFloor={showFloor}
        showWalls={showWalls}
        floorColor={floorColor}
        wallColor={wallColor}
        onShowFloorChange={handleShowFloorChange}
        onShowWallsChange={handleShowWallsChange}
        onFloorColorChange={handleFloorColorChange}
        onWallColorChange={handleWallColorChange}
        objectMoveSpeed={objectMoveSpeed}
        onObjectMoveSpeedChange={handleObjectMoveSpeedChange}
        lightIntensity={lightIntensity}
        onLightIntensityChange={handleLightIntensityChange}
        showLightBeam={showLightBeam}
        onShowLightBeamChange={handleShowLightBeamChange}
      />
      {error && (
        <div style={{ position: 'absolute', top: 12, left: 12, padding: 8, background: '#2b2f36', borderRadius: 6, maxWidth: 420 }}>
          <b>Ошибка WebGPU:</b> {error}
        </div>
      )}
    </div>
  );
}
