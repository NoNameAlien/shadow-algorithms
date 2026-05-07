import { type RefObject, useCallback, useEffect, useState } from 'react';
import { Renderer, type LightMode } from '../engine/Renderer';
import type { ShadowParams } from '../components/ControlPanel';
import type { LightScreenPosition } from '../components/SceneViewport';
import { hexToRgb01, rgb01ToHex } from '../utils/color';
import { downloadJsonFile, readJsonFile } from '../utils/sceneFile';
import { validateSceneDTO } from '../utils/sceneValidation';
import { SCENE_PRESETS, type ScenePresetId } from '../engine/presets';
import type { ObjectScale, ScenePresetSelection } from '../components/control-panel/types';

type Lang = 'en' | 'ru';
type MeshOption = { id: number; name: string };
type EntityMeta = { count: number; activeIndex: number; names: string[] };

type ObjectPanelState = {
  color: string;
  castShadows: boolean;
  receiveShadows: boolean;
  selfShadows: boolean;
  scale: ObjectScale;
  meshId: number;
  specular: number;
  shininess: number;
  roughness: number;
};

type LightPanelState = {
  mode: LightMode;
  intensity: number;
  color: string;
  innerConeDeg: number;
  outerConeDeg: number;
  range: number;
  falloff: number;
};

const DEFAULT_LIGHT_STATE: LightPanelState = {
  mode: 'sun',
  intensity: 1.0,
  color: '#ffffff',
  innerConeDeg: 15,
  outerConeDeg: 28,
  range: 12,
  falloff: 1.5
};

const DEFAULT_OBJECT_STATE: ObjectPanelState = {
  color: '#ffffff',
  castShadows: true,
  receiveShadows: false,
  selfShadows: false,
  scale: [1, 1, 1],
  meshId: 0,
  specular: 0.5,
  shininess: 32,
  roughness: 0.45
};

const DEFAULT_META: EntityMeta = { count: 1, activeIndex: 0, names: [] };

const sameMeta = (left: EntityMeta, right: EntityMeta) =>
  left.count === right.count &&
  left.activeIndex === right.activeIndex &&
  left.names.length === right.names.length &&
  left.names.every((name, index) => name === right.names[index]);

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
  left.selfShadows === right.selfShadows &&
  left.scale[0] === right.scale[0] &&
  left.scale[1] === right.scale[1] &&
  left.scale[2] === right.scale[2] &&
  left.meshId === right.meshId &&
  left.specular === right.specular &&
  left.shininess === right.shininess &&
  left.roughness === right.roughness;

const sameLightState = (left: LightPanelState, right: LightPanelState) =>
  left.mode === right.mode &&
  left.intensity === right.intensity &&
  left.color === right.color &&
  left.innerConeDeg === right.innerConeDeg &&
  left.outerConeDeg === right.outerConeDeg &&
  left.range === right.range &&
  left.falloff === right.falloff;

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
  const [floorSize, setFloorSize] = useState(10);
  const [showGrid, setShowGrid] = useState(true);
  const [floorColor, setFloorColor] = useState('#26282d');
  const [wallColor, setWallColor] = useState('#1f2226');
  const [lightsScreen, setLightsScreen] = useState<LightScreenPosition[]>([]);
  const [lightMeta, setLightMeta] = useState<EntityMeta>(DEFAULT_META);
  const [objectMeta, setObjectMeta] = useState<EntityMeta>(DEFAULT_META);
  const [meshOptions, setMeshOptions] = useState<MeshOption[]>([]);
  const [lightState, setLightState] = useState<LightPanelState>(DEFAULT_LIGHT_STATE);
  const [objectState, setObjectState] = useState<ObjectPanelState>(DEFAULT_OBJECT_STATE);
  const [activeScenePreset, setActiveScenePreset] = useState<ScenePresetSelection>('custom');

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
      selfShadows: objectInfo.selfShadows,
      scale: objectInfo.scale,
      meshId: objectInfo.meshId,
      specular: objectInfo.specular,
      shininess: objectInfo.shininess,
      roughness: objectInfo.roughness
    }, sameObjectState);

    const lightInfo = renderer.getLightInfo();
    syncState(setLightState, {
      mode: lightInfo.mode,
      intensity: lightInfo.intensity,
      color: rgb01ToHex(lightInfo.color),
      innerConeDeg: lightInfo.innerConeDeg,
      outerConeDeg: lightInfo.outerConeDeg,
      range: lightInfo.range,
      falloff: lightInfo.falloff
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
    setActiveScenePreset('custom');
    syncFromRenderer();
  };

  const handleResetModel = () => {
    runRendererCommand((renderer) => renderer.resetModel());
  };

  const handleResetScene = () => {
    runRendererCommand((renderer) => renderer.resetScene());
    setActiveScenePreset('custom');
    setFloorSize(10);
    setShowGrid(true);
  };

  const handleLightingPreset = () => {
    runRendererCommand((renderer) => renderer.applyLightingPreset());
    setActiveScenePreset('custom');
  };

  const handleScenePresetChange = (presetId: ScenePresetId) => {
    const preset = SCENE_PRESETS[presetId];
    setActiveScenePreset(presetId);
    setShowFloor(preset.showFloor);
    setShowWalls(preset.showWalls);
    setFloorSize(preset.floorSize ?? 10);
    setShowGrid(preset.showGrid ?? true);
    setFloorColor(rgb01ToHex(preset.floorColor));
    setWallColor(rgb01ToHex(preset.wallColor));
    setShowLightBeam(true);
    runRendererCommand((renderer) => renderer.applyScenePreset(presetId));
  };

  const handleSaveScene = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    downloadJsonFile(renderer.exportScene(), 'scene.json');
  };

  const handleLoadSceneFile = (file: File) => {
    readJsonFile<unknown>(
      file,
      (data) => {
        const scene = validateSceneDTO(data);
        setActiveScenePreset('custom');
        setShowFloor(scene.showFloor);
        setShowWalls(scene.showWalls);
        setFloorSize(scene.floorSize ?? 10);
        setShowGrid(scene.showGrid ?? true);
        setFloorColor(rgb01ToHex(scene.floorColor));
        setWallColor(rgb01ToHex(scene.wallColor));
        runRendererCommand((renderer) => renderer.importScene(scene));
      },
      (error) => {
        console.error('Failed to load scene:', error);
        alert(`Ошибка загрузки сцены: ${error instanceof Error ? error.message : 'некорректный JSON'}`);
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

  const handleSpotInnerConeDegChange = (value: number) => {
    setLightState((previous) => ({ ...previous, innerConeDeg: value }));
    runRendererCommand((renderer) => renderer.setActiveLightSpotInnerCone(value));
  };

  const handleSpotOuterConeDegChange = (value: number) => {
    setLightState((previous) => ({ ...previous, outerConeDeg: value }));
    runRendererCommand((renderer) => renderer.setActiveLightSpotOuterCone(value));
  };

  const handleSpotRangeChange = (value: number) => {
    setLightState((previous) => ({ ...previous, range: value }));
    runRendererCommand((renderer) => renderer.setActiveLightSpotRange(value));
  };

  const handleSpotFalloffChange = (value: number) => {
    setLightState((previous) => ({ ...previous, falloff: value }));
    runRendererCommand((renderer) => renderer.setActiveLightSpotFalloff(value));
  };

  const handleLoadObjectTexture = (file: File) => {
    rendererRef.current?.loadObjectTexture(file);
  };

  const handleLoadFloorTexture = (file: File) => {
    rendererRef.current?.loadFloorTexture(file);
  };

  const handleShowFloorChange = (value: boolean) => {
    setShowFloor(value);
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.setFloorVisible(value));
  };

  const handleShowWallsChange = (value: boolean) => {
    setShowWalls(value);
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.setWallsVisible(value));
  };

  const handleFloorSizeChange = (value: number) => {
    setFloorSize(value);
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.setFloorSize(value));
  };

  const handleShowGridChange = (value: boolean) => {
    setShowGrid(value);
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.setGridVisible(value));
  };

  const handleFloorColorChange = (hex: string) => {
    setFloorColor(hex);
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.setFloorColor(hexToRgb01(hex)));
  };

  const handleWallColorChange = (hex: string) => {
    setWallColor(hex);
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.setWallColor(hexToRgb01(hex)));
  };

  const handleSelectLight = (index: number) => {
    runRendererCommand((renderer) => renderer.setActiveLight(index));
  };

  const handleAddLight = () => {
    if (lightMeta.count >= 8) return;
    runRendererCommand((renderer) => renderer.addLight());
  };

  const handleRemoveLight = () => {
    runRendererCommand((renderer) => renderer.removeLight(lightMeta.activeIndex));
  };

  const handleRenameLight = (index: number, name: string) => {
    runRendererCommand((renderer) => renderer.renameLight(index, name));
  };

  const handleSelectObject = (index: number) => {
    runRendererCommand((renderer) => renderer.setActiveObject(index));
  };

  const handleAddObject = () => {
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.addObject());
  };

  const handleRemoveObject = () => {
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.removeObject(objectMeta.activeIndex));
  };

  const handleRenameObject = (index: number, name: string) => {
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.renameObject(index, name));
  };

  const handleObjectColorChange = (hex: string) => {
    setObjectState((previous) => ({ ...previous, color: hex }));
    setActiveScenePreset('custom');
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

  const handleObjectSelfShadowsChange = (value: boolean) => {
    setObjectState((previous) => ({ ...previous, selfShadows: value }));
    runRendererCommand((renderer) => renderer.setActiveObjectSelfShadows(value));
  };

  const handleObjectScaleChange = (scale: ObjectScale) => {
    setObjectState((previous) => ({ ...previous, scale }));
    setActiveScenePreset('custom');
    runRendererCommand((renderer) => renderer.setActiveObjectScale(scale));
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
    setObjectState((previous) => ({ ...previous, shininess: value, roughness: Math.max(0.02, Math.min(1, 1 - (value - 4) / 124)) }));
    runRendererCommand((renderer) => renderer.setActiveObjectShininess(value));
  };

  const handleObjectRoughnessChange = (value: number) => {
    setObjectState((previous) => ({ ...previous, roughness: value, shininess: 4 + (1 - value) * 124 }));
    runRendererCommand((renderer) => renderer.setActiveObjectRoughness(value));
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
      onLightingPreset: handleLightingPreset,
      activeScenePreset,
      onScenePresetChange: handleScenePresetChange,
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
      floorSize,
      showGrid,
      floorColor,
      wallColor,
      onShowFloorChange: handleShowFloorChange,
      onShowWallsChange: handleShowWallsChange,
      onFloorSizeChange: handleFloorSizeChange,
      onShowGridChange: handleShowGridChange,
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
      spotInnerConeDeg: lightState.innerConeDeg,
      onSpotInnerConeDegChange: handleSpotInnerConeDegChange,
      spotOuterConeDeg: lightState.outerConeDeg,
      onSpotOuterConeDegChange: handleSpotOuterConeDegChange,
      spotRange: lightState.range,
      onSpotRangeChange: handleSpotRangeChange,
      spotFalloff: lightState.falloff,
      onSpotFalloffChange: handleSpotFalloffChange,
      lightCount: lightMeta.count,
      activeLightIndex: lightMeta.activeIndex,
      lightNames: lightMeta.names,
      onSelectLight: handleSelectLight,
      onAddLight: handleAddLight,
      onRemoveLight: handleRemoveLight,
      onRenameLight: handleRenameLight,
      objectCount: objectMeta.count,
      activeObjectIndex: objectMeta.activeIndex,
      objectNames: objectMeta.names,
      onSelectObject: handleSelectObject,
      onAddObject: handleAddObject,
      onRemoveObject: handleRemoveObject,
      onRenameObject: handleRenameObject,
      onSaveScene: handleSaveScene,
      onLoadSceneFile: handleLoadSceneFile,
      objectColor: objectState.color,
      onObjectColorChange: handleObjectColorChange,
      objectScale: objectState.scale,
      onObjectScaleChange: handleObjectScaleChange,
      objectCastShadows: objectState.castShadows,
      onObjectCastShadowsChange: handleObjectCastShadowsChange,
      objectReceiveShadows: objectState.receiveShadows,
      onObjectReceiveShadowsChange: handleObjectReceiveShadowsChange,
      objectSelfShadows: objectState.selfShadows,
      onObjectSelfShadowsChange: handleObjectSelfShadowsChange,
      meshOptions,
      activeMeshId: objectState.meshId,
      onObjectMeshChange: handleObjectMeshChange,
      objectSpecular: objectState.specular,
      onObjectSpecularChange: handleObjectSpecularChange,
      objectShininess: objectState.shininess,
      onObjectShininessChange: handleObjectShininessChange,
      objectRoughness: objectState.roughness,
      onObjectRoughnessChange: handleObjectRoughnessChange
    }
  };
};
