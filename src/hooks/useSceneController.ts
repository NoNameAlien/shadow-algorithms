import { type RefObject, useCallback, useEffect, useState } from 'react';
import { Renderer, type LightMode } from '../engine/Renderer';
import type { ShadowParams } from '../components/ControlPanel';
import type { LightScreenPosition } from '../components/SceneViewport';
import { hexToRgb01, rgb01ToHex } from '../utils/color';
import { downloadJsonFile, readJsonFile } from '../utils/sceneFile';

type Lang = 'en' | 'ru';
type MeshOption = { id: number; name: string };
type EntityMeta = { count: number; activeIndex: number };
type SceneSnapshot = ReturnType<Renderer['exportScene']>;

type ObjectPanelState = {
  color: string;
  castShadows: boolean;
  receiveShadows: boolean;
  meshId: number;
  specular: number;
  shininess: number;
};

type LightPanelState = {
  mode: LightMode;
  intensity: number;
  color: string;
  castShadows: boolean;
};

const DEFAULT_LIGHT_STATE: LightPanelState = {
  mode: 'sun',
  intensity: 1.0,
  color: '#ffffff',
  castShadows: true
};

const DEFAULT_OBJECT_STATE: ObjectPanelState = {
  color: '#ffffff',
  castShadows: true,
  receiveShadows: true,
  meshId: 0,
  specular: 0.5,
  shininess: 32
};

const DEFAULT_META: EntityMeta = { count: 1, activeIndex: 0 };

const sameMeta = (left: EntityMeta, right: EntityMeta) =>
  left.count === right.count && left.activeIndex === right.activeIndex;

const sameMeshes = (left: MeshOption[], right: MeshOption[]) =>
  left.length === right.length &&
  left.every((mesh, index) => mesh.id === right[index].id && mesh.name === right[index].name);

const sameLightsScreen = (left: LightScreenPosition[], right: LightScreenPosition[]) =>
  left.length === right.length &&
  left.every((light, index) => {
    const other = right[index];
    return (
      light.visible === other.visible &&
      light.mode === other.mode &&
      light.active === other.active &&
      Math.abs(light.x - other.x) < 0.5 &&
      Math.abs(light.y - other.y) < 0.5
    );
  });

const sameObjectState = (left: ObjectPanelState, right: ObjectPanelState) =>
  left.color === right.color &&
  left.castShadows === right.castShadows &&
  left.receiveShadows === right.receiveShadows &&
  left.meshId === right.meshId &&
  left.specular === right.specular &&
  left.shininess === right.shininess;

const sameLightState = (left: LightPanelState, right: LightPanelState) =>
  left.mode === right.mode &&
  left.intensity === right.intensity &&
  left.color === right.color &&
  left.castShadows === right.castShadows;

const syncState = <T,>(setter: (updater: (previous: T) => T) => void, next: T, same: (left: T, right: T) => boolean) => {
  setter((previous) => (same(previous, next) ? previous : next));
};

export const useSceneController = (rendererRef: RefObject<Renderer | null>) => {
  const [lang, setLang] = useState<Lang>('ru');
  const [autoRotate, setAutoRotate] = useState(true);
  const [objectMoveSpeed, setObjectMoveSpeed] = useState(1.0);
  const [showLightBeam, setShowLightBeam] = useState(true);
  const [showFloor, setShowFloor] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [floorColor, setFloorColor] = useState('#26282d');
  const [wallColor, setWallColor] = useState('#1f2226');
  const [lightsScreen, setLightsScreen] = useState<LightScreenPosition[]>([]);
  const [lightMeta, setLightMeta] = useState<EntityMeta>(DEFAULT_META);
  const [objectMeta, setObjectMeta] = useState<EntityMeta>(DEFAULT_META);
  const [meshOptions, setMeshOptions] = useState<MeshOption[]>([]);
  const [lightState, setLightState] = useState<LightPanelState>(DEFAULT_LIGHT_STATE);
  const [objectState, setObjectState] = useState<ObjectPanelState>(DEFAULT_OBJECT_STATE);

  const syncFromRenderer = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    syncState(setLightsScreen, renderer.getAllLightsScreenPositions(), sameLightsScreen);
    syncState(setLightMeta, renderer.getLightsMeta(), sameMeta);
    syncState(setObjectMeta, renderer.getObjectsMeta(), sameMeta);
    syncState(setMeshOptions, renderer.getMeshesMeta(), sameMeshes);

    const objectInfo = renderer.getActiveObjectInfo();
    syncState(setObjectState, {
      color: rgb01ToHex(objectInfo.color),
      castShadows: objectInfo.castShadows,
      receiveShadows: objectInfo.receiveShadows,
      meshId: objectInfo.meshId,
      specular: objectInfo.specular,
      shininess: objectInfo.shininess
    }, sameObjectState);

    const lightInfo = renderer.getLightInfo();
    syncState(setLightState, {
      mode: lightInfo.mode,
      intensity: lightInfo.intensity,
      color: rgb01ToHex(lightInfo.color),
      castShadows: lightInfo.castShadows
    }, sameLightState);
  }, [rendererRef]);

  useEffect(() => {
    syncFromRenderer();
    const intervalId = window.setInterval(syncFromRenderer, 120);
    return () => window.clearInterval(intervalId);
  }, [syncFromRenderer]);

  const runRendererCommand = useCallback((command: (renderer: Renderer) => void) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    command(renderer);
    syncFromRenderer();
  }, [rendererRef, syncFromRenderer]);

  const handleParamsChange = (params: ShadowParams) => {
    runRendererCommand((renderer) => renderer.updateShadowParams(params));
  };

  const handleLoadModel = async (file: File) => {
    await rendererRef.current?.loadModel(file);
    syncFromRenderer();
  };

  const handleResetModel = () => {
    runRendererCommand((renderer) => renderer.resetModel());
  };

  const handleResetScene = () => {
    runRendererCommand((renderer) => renderer.resetScene());
  };

  const handleSaveScene = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    downloadJsonFile(renderer.exportScene(), 'scene.json');
  };

  const handleLoadSceneFile = (file: File) => {
    readJsonFile<SceneSnapshot>(
      file,
      (scene) => runRendererCommand((renderer) => renderer.importScene(scene)),
      (error) => {
        console.error('Failed to load scene:', error);
        alert('Ошибка загрузки сцены: некорректный JSON');
      }
    );
  };

  const handleLightModeChange = (mode: LightMode) => {
    setLightState((previous) => ({ ...previous, mode }));
    runRendererCommand((renderer) => renderer.setLightMode(mode));
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
    runRendererCommand((renderer) => renderer.setObjectMoveSpeed(value));
  };

  const handleLightIntensityChange = (value: number) => {
    setLightState((previous) => ({ ...previous, intensity: value }));
    runRendererCommand((renderer) => renderer.setLightIntensity(value));
  };

  const handleShowLightBeamChange = (value: boolean) => {
    setShowLightBeam(value);
    runRendererCommand((renderer) => renderer.setShowLightBeam(value));
  };

  const handleLightColorChange = (hex: string) => {
    setLightState((previous) => ({ ...previous, color: hex }));
    runRendererCommand((renderer) => renderer.setLightColor(hexToRgb01(hex)));
  };

  const handleLightCastShadowsChange = (value: boolean) => {
    setLightState((previous) => ({ ...previous, castShadows: value }));
    runRendererCommand((renderer) => renderer.setActiveLightCastShadows(value));
  };

  const handleLoadObjectTexture = (file: File) => {
    rendererRef.current?.loadObjectTexture(file);
  };

  const handleLoadFloorTexture = (file: File) => {
    rendererRef.current?.loadFloorTexture(file);
  };

  const handleShowFloorChange = (value: boolean) => {
    setShowFloor(value);
    runRendererCommand((renderer) => renderer.setFloorVisible(value));
  };

  const handleShowWallsChange = (value: boolean) => {
    setShowWalls(value);
    runRendererCommand((renderer) => renderer.setWallsVisible(value));
  };

  const handleFloorColorChange = (hex: string) => {
    setFloorColor(hex);
    runRendererCommand((renderer) => renderer.setFloorColor(hexToRgb01(hex)));
  };

  const handleWallColorChange = (hex: string) => {
    setWallColor(hex);
    runRendererCommand((renderer) => renderer.setWallColor(hexToRgb01(hex)));
  };

  const handleSelectLight = (index: number) => {
    runRendererCommand((renderer) => renderer.setActiveLight(index));
  };

  const handleAddLight = () => {
    runRendererCommand((renderer) => renderer.addLight());
  };

  const handleRemoveLight = () => {
    runRendererCommand((renderer) => renderer.removeLight(lightMeta.activeIndex));
  };

  const handleSelectObject = (index: number) => {
    runRendererCommand((renderer) => renderer.setActiveObject(index));
  };

  const handleAddObject = () => {
    runRendererCommand((renderer) => renderer.addObject());
  };

  const handleRemoveObject = () => {
    runRendererCommand((renderer) => renderer.removeObject(objectMeta.activeIndex));
  };

  const handleObjectColorChange = (hex: string) => {
    setObjectState((previous) => ({ ...previous, color: hex }));
    runRendererCommand((renderer) => renderer.setActiveObjectColor(hexToRgb01(hex)));
  };

  const handleObjectCastShadowsChange = (value: boolean) => {
    setObjectState((previous) => ({ ...previous, castShadows: value }));
    runRendererCommand((renderer) => renderer.setActiveObjectCastShadows(value));
  };

  const handleObjectReceiveShadowsChange = (value: boolean) => {
    setObjectState((previous) => ({ ...previous, receiveShadows: value }));
    runRendererCommand((renderer) => renderer.setActiveObjectReceiveShadows(value));
  };

  const handleObjectMeshChange = (meshId: number) => {
    setObjectState((previous) => ({ ...previous, meshId }));
    runRendererCommand((renderer) => renderer.setActiveObjectMesh(meshId));
  };

  const handleObjectSpecularChange = (value: number) => {
    setObjectState((previous) => ({ ...previous, specular: value }));
    runRendererCommand((renderer) => renderer.setActiveObjectSpecular(value));
  };

  const handleObjectShininessChange = (value: number) => {
    setObjectState((previous) => ({ ...previous, shininess: value }));
    runRendererCommand((renderer) => renderer.setActiveObjectShininess(value));
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
      lightMode: lightState.mode,
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
      lightIntensity: lightState.intensity,
      onLightIntensityChange: handleLightIntensityChange,
      showLightBeam,
      onShowLightBeamChange: handleShowLightBeamChange,
      lightColor: lightState.color,
      onLightColorChange: handleLightColorChange,
      lightCastShadows: lightState.castShadows,
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
      objectColor: objectState.color,
      onObjectColorChange: handleObjectColorChange,
      objectCastShadows: objectState.castShadows,
      onObjectCastShadowsChange: handleObjectCastShadowsChange,
      objectReceiveShadows: objectState.receiveShadows,
      onObjectReceiveShadowsChange: handleObjectReceiveShadowsChange,
      meshOptions,
      activeMeshId: objectState.meshId,
      onObjectMeshChange: handleObjectMeshChange,
      objectSpecular: objectState.specular,
      onObjectSpecularChange: handleObjectSpecularChange,
      objectShininess: objectState.shininess,
      onObjectShininessChange: handleObjectShininessChange
    }
  };
};
