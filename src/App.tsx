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
  const [lightColor, setLightColor] = useState('#ffffff');

  const [objectColor, setObjectColor] = useState('#ffffff');
  const [objectCastShadows, setObjectCastShadows] = useState(true);
  const [objectReceiveShadows, setObjectReceiveShadows] = useState(true);

  const [lightCastShadows, setLightCastShadows] = useState(true);
  const [meshOptions, setMeshOptions] = useState<{ id: number; name: string }[]>([]);
  const [activeMeshId, setActiveMeshId] = useState(0);
  const [objectSpecular, setObjectSpecular] = useState(0.5);
  const [objectShininess, setObjectShininess] = useState(32);

  const [lightsScreen, setLightsScreen] = useState<
    { x: number; y: number; visible: boolean; mode: LightMode; active: boolean }[]
  >([]);

  const [lightScreenPos, setLightScreenPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false
  });
  const [lightMeta, setLightMeta] = useState<{ count: number; activeIndex: number }>({
    count: 1,
    activeIndex: 0
  });
  const [objectMeta, setObjectMeta] = useState<{ count: number; activeIndex: number }>({
    count: 1,
    activeIndex: 0
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
        const list = r.getAllLightsScreenPositions();
        setLightsScreen(list);

        const meta = r.getLightsMeta();
        setLightMeta(meta);

        const objMeta = r.getObjectsMeta();
        setObjectMeta(objMeta);

        const objInfo = r.getActiveObjectInfo();
        setObjectColor(rgb01ToHex(objInfo.color));
        setObjectCastShadows(objInfo.castShadows);
        setObjectReceiveShadows(objInfo.receiveShadows);
        setActiveMeshId(objInfo.meshId);
        setObjectSpecular(objInfo.specular);
        setObjectShininess(objInfo.shininess);

        const lightInfo = r.getLightInfo();
        setLightMode(lightInfo.mode);
        setLightIntensity(lightInfo.intensity);
        setLightColor(rgb01ToHex(lightInfo.color));
        setLightCastShadows(lightInfo.castShadows);

        const meshes = r.getMeshesMeta();
        setMeshOptions(meshes);
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleLightColorChange = (hex: string) => {
    setLightColor(hex);
    rendererRef.current?.setLightColor(hexToRgb01(hex));
  };

  const handleSaveScene = () => {
    const r = rendererRef.current;
    if (!r) return;
    const scene = r.exportScene();
    const json = JSON.stringify(scene, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadSceneFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const scene = JSON.parse(text);
        rendererRef.current?.importScene(scene);
      } catch (e) {
        console.error('Failed to load scene:', e);
        alert('Ошибка загрузки сцены: некорректный JSON');
      }
    };
    reader.readAsText(file);
  };

  const hexToRgb01 = (hex: string): [number, number, number] => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return [0.2, 0.2, 0.2];
    const intVal = parseInt(m[1], 16);
    const r = ((intVal >> 16) & 255) / 255;
    const g = ((intVal >> 8) & 255) / 255;
    const b = (intVal & 255) / 255;
    return [r, g, b];
  };

  const rgb01ToHex = (rgb: [number, number, number]): string => {
    const [r, g, b] = rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
    const toHex = (x: number) => x.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

  const handleObjectSpecularChange = (value: number) => {
    setObjectSpecular(value);
    rendererRef.current?.setActiveObjectSpecular(value);
  };

  const handleObjectShininessChange = (value: number) => {
    setObjectShininess(value);
    rendererRef.current?.setActiveObjectShininess(value);
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

  const handleObjectMeshChange = (meshId: number) => {
    setActiveMeshId(meshId);
    rendererRef.current?.setActiveObjectMesh(meshId);
  };

  const handleLightCastShadowsChange = (value: boolean) => {
    setLightCastShadows(value);
    rendererRef.current?.setActiveLightCastShadows(value);
  };

  const handleObjectColorChange = (hex: string) => {
    setObjectColor(hex);
    rendererRef.current?.setActiveObjectColor(hexToRgb01(hex));
  };

  const handleObjectCastShadowsChange = (value: boolean) => {
    setObjectCastShadows(value);
    rendererRef.current?.setActiveObjectCastShadows(value);
  };

  const handleObjectReceiveShadowsChange = (value: boolean) => {
    setObjectReceiveShadows(value);
    rendererRef.current?.setActiveObjectReceiveShadows(value);
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

  const handleSelectLight = (index: number) => {
    rendererRef.current?.setActiveLight(index);
  };

  const handleAddLight = () => {
    rendererRef.current?.addLight();
  };

  const handleRemoveLight = () => {
    rendererRef.current?.removeLight(lightMeta.activeIndex);
  };

  const handleSelectObject = (index: number) => {
    rendererRef.current?.setActiveObject(index);
  };

  const handleAddObject = () => {
    rendererRef.current?.addObject();
  };

  const handleRemoveObject = () => {
    rendererRef.current?.removeObject(objectMeta.activeIndex);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#14161a', color: '#e6e6e6' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <canvas
          ref={ref}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Иконки всех источников света поверх canvas */}
        {lightsScreen.map((l, idx) =>
          l.visible ? (
            <img
              key={idx}
              src={
                l.mode === 'sun'
                  ? sunIcon
                  : l.mode === 'spot'
                    ? spotIcon
                    : topIcon
              }
              alt={l.mode}
              style={{
                position: 'absolute',
                left: l.x - 16,
                top: l.y - 16,
                width: l.active ? 32 : 24,
                height: l.active ? 32 : 24,
                opacity: l.active ? 1.0 : 0.7,
                pointerEvents: 'none',
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
        lightColor={lightColor}
        onLightColorChange={handleLightColorChange}
        lightCastShadows={lightCastShadows}
        onLightCastShadowsChange={handleLightCastShadowsChange}
        lightCount={lightMeta.count}
        activeLightIndex={lightMeta.activeIndex}
        onSelectLight={handleSelectLight}
        onAddLight={handleAddLight}
        onRemoveLight={handleRemoveLight}
        objectCount={objectMeta.count}
        activeObjectIndex={objectMeta.activeIndex}
        onSelectObject={handleSelectObject}
        onAddObject={handleAddObject}
        onRemoveObject={handleRemoveObject}
        onSaveScene={handleSaveScene}
        onLoadSceneFile={handleLoadSceneFile}
        objectColor={objectColor}
        onObjectColorChange={handleObjectColorChange}
        objectCastShadows={objectCastShadows}
        onObjectCastShadowsChange={handleObjectCastShadowsChange}
        objectReceiveShadows={objectReceiveShadows}
        onObjectReceiveShadowsChange={handleObjectReceiveShadowsChange}
        meshOptions={meshOptions}
        activeMeshId={activeMeshId}
        onObjectMeshChange={handleObjectMeshChange}
        objectSpecular={objectSpecular}
        onObjectSpecularChange={handleObjectSpecularChange}
        objectShininess={objectShininess}
        onObjectShininessChange={handleObjectShininessChange}
      />
      {error && (
        <div style={{ position: 'absolute', top: 12, left: 12, padding: 8, background: '#2b2f36', borderRadius: 6, maxWidth: 420 }}>
          <b>Ошибка WebGPU:</b> {error}
        </div>
      )}
    </div>
  );
}
