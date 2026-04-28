import { type RefObject, useEffect, useState } from 'react';
import { Renderer, type LightMode } from '../engine/Renderer';
import type { ShadowParams } from '../components/ControlPanel';
import type { LightScreenPosition } from '../components/SceneViewport';
import { hexToRgb01, rgb01ToHex } from '../utils/color';
import { downloadJsonFile, readJsonFile } from '../utils/sceneFile';

type Lang = 'en' | 'ru';
type MeshOption = { id: number; name: string };
type EntityMeta = { count: number; activeIndex: number };
type SceneSnapshot = ReturnType<Renderer['exportScene']>;

export const useRendererControls = (rendererRef: RefObject<Renderer | null>) => {
  const [lightMode, setLightMode] = useState<LightMode>('sun');
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
  const [meshOptions, setMeshOptions] = useState<MeshOption[]>([]);
  const [activeMeshId, setActiveMeshId] = useState(0);
  const [objectSpecular, setObjectSpecular] = useState(0.5);
  const [objectShininess, setObjectShininess] = useState(32);
  const [lightsScreen, setLightsScreen] = useState<LightScreenPosition[]>([]);
  const [lightMeta, setLightMeta] = useState<EntityMeta>({ count: 1, activeIndex: 0 });
  const [objectMeta, setObjectMeta] = useState<EntityMeta>({ count: 1, activeIndex: 0 });

  useEffect(() => {
    let frameId: number;

    const syncFromRenderer = () => {
      const renderer = rendererRef.current;

      if (renderer) {
        setLightsScreen(renderer.getAllLightsScreenPositions());
        setLightMeta(renderer.getLightsMeta());
        setObjectMeta(renderer.getObjectsMeta());

        const objectInfo = renderer.getActiveObjectInfo();
        setObjectColor(rgb01ToHex(objectInfo.color));
        setObjectCastShadows(objectInfo.castShadows);
        setObjectReceiveShadows(objectInfo.receiveShadows);
        setActiveMeshId(objectInfo.meshId);
        setObjectSpecular(objectInfo.specular);
        setObjectShininess(objectInfo.shininess);

        const lightInfo = renderer.getLightInfo();
        setLightMode(lightInfo.mode);
        setLightIntensity(lightInfo.intensity);
        setLightColor(rgb01ToHex(lightInfo.color));
        setLightCastShadows(lightInfo.castShadows);

        setMeshOptions(renderer.getMeshesMeta());
      }

      frameId = requestAnimationFrame(syncFromRenderer);
    };

    frameId = requestAnimationFrame(syncFromRenderer);
    return () => cancelAnimationFrame(frameId);
  }, [rendererRef]);

  const handleParamsChange = (params: ShadowParams) => {
    rendererRef.current?.updateShadowParams(params);
  };

  const handleLoadModel = async (file: File) => {
    await rendererRef.current?.loadModel(file);
  };

  const handleResetModel = () => {
    rendererRef.current?.resetModel();
  };

  const handleResetScene = () => {
    rendererRef.current?.resetScene();
  };

  const handleSaveScene = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    downloadJsonFile(renderer.exportScene(), 'scene.json');
  };

  const handleLoadSceneFile = (file: File) => {
    readJsonFile<SceneSnapshot>(
      file,
      (scene) => rendererRef.current?.importScene(scene),
      (error) => {
        console.error('Failed to load scene:', error);
        alert('Ошибка загрузки сцены: некорректный JSON');
      }
    );
  };

  const handleLightModeChange = (mode: LightMode) => {
    setLightMode(mode);
    rendererRef.current?.setLightMode(mode);
  };

  const handleToggleAutoRotate = () => {
    setAutoRotate((previous) => {
      const next = !previous;
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

  const handleLightColorChange = (hex: string) => {
    setLightColor(hex);
    rendererRef.current?.setLightColor(hexToRgb01(hex));
  };

  const handleLightCastShadowsChange = (value: boolean) => {
    setLightCastShadows(value);
    rendererRef.current?.setActiveLightCastShadows(value);
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

  const handleObjectMeshChange = (meshId: number) => {
    setActiveMeshId(meshId);
    rendererRef.current?.setActiveObjectMesh(meshId);
  };

  const handleObjectSpecularChange = (value: number) => {
    setObjectSpecular(value);
    rendererRef.current?.setActiveObjectSpecular(value);
  };

  const handleObjectShininessChange = (value: number) => {
    setObjectShininess(value);
    rendererRef.current?.setActiveObjectShininess(value);
  };

  return {
    viewportProps: {
      lightsScreen
    },
    panelProps: {
      onParamsChange: handleParamsChange,
      onLoadModel: handleLoadModel,
      onResetScene: handleResetScene,
      onResetModel: handleResetModel,
      lightMode,
      onLightModeChange: handleLightModeChange,
      onLoadObjectTexture: handleLoadObjectTexture,
      onLoadFloorTexture: handleLoadFloorTexture,
      lang,
      onLanguageChange: setLang,
      autoRotate,
      onToggleAutoRotate: handleToggleAutoRotate,
      showFloor,
      showWalls,
      floorColor,
      wallColor,
      onShowFloorChange: handleShowFloorChange,
      onShowWallsChange: handleShowWallsChange,
      onFloorColorChange: handleFloorColorChange,
      onWallColorChange: handleWallColorChange,
      objectMoveSpeed,
      onObjectMoveSpeedChange: handleObjectMoveSpeedChange,
      lightIntensity,
      onLightIntensityChange: handleLightIntensityChange,
      showLightBeam,
      onShowLightBeamChange: handleShowLightBeamChange,
      lightColor,
      onLightColorChange: handleLightColorChange,
      lightCastShadows,
      onLightCastShadowsChange: handleLightCastShadowsChange,
      lightCount: lightMeta.count,
      activeLightIndex: lightMeta.activeIndex,
      onSelectLight: handleSelectLight,
      onAddLight: handleAddLight,
      onRemoveLight: handleRemoveLight,
      objectCount: objectMeta.count,
      activeObjectIndex: objectMeta.activeIndex,
      onSelectObject: handleSelectObject,
      onAddObject: handleAddObject,
      onRemoveObject: handleRemoveObject,
      onSaveScene: handleSaveScene,
      onLoadSceneFile: handleLoadSceneFile,
      objectColor,
      onObjectColorChange: handleObjectColorChange,
      objectCastShadows,
      onObjectCastShadowsChange: handleObjectCastShadowsChange,
      objectReceiveShadows,
      onObjectReceiveShadowsChange: handleObjectReceiveShadowsChange,
      meshOptions,
      activeMeshId,
      onObjectMeshChange: handleObjectMeshChange,
      objectSpecular,
      onObjectSpecularChange: handleObjectSpecularChange,
      objectShininess,
      onObjectShininessChange: handleObjectShininessChange
    }
  };
};
