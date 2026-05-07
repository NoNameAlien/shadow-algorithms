import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { INITIAL_PARAMS, STRINGS } from './constants';
import { SCENE_PRESETS } from '../../engine/presets';
import { Header } from './Header';
import { HintsSection } from './HintsSection';
import { LightControls } from './LightControls';
import { ObjectControls } from './ObjectControls';
import { SceneControls } from './SceneControls';
import { ShadowSettings } from './ShadowSettings';
import { dangerButtonStyle, panelStyle, primaryButtonStyle } from './styles';
import type { ControlPanelProps, ShadowParams } from './types';

export function ControlPanel({
  onParamsChange,
  onLoadModel,
  onResetScene,
  onResetModel,
  onLightingPreset,
  activeScenePreset,
  onScenePresetChange,
  onLoadObjectTexture,
  onLoadFloorTexture,
  isPointerLocked = false,
  lightMode,
  onLightModeChange,
  lang,
  onLanguageChange,
  autoRotate,
  onToggleAutoRotate,
  showFloor,
  showWalls,
  floorSize,
  showGrid,
  floorColor,
  wallColor,
  onShowFloorChange,
  onShowWallsChange,
  onFloorSizeChange,
  onShowGridChange,
  onFloorColorChange,
  onWallColorChange,
  objectMoveSpeed,
  onObjectMoveSpeedChange,
  lightIntensity,
  onLightIntensityChange,
  showLightBeam,
  onShowLightBeamChange,
  lightColor,
  onLightColorChange,
  spotInnerConeDeg,
  onSpotInnerConeDegChange,
  spotOuterConeDeg,
  onSpotOuterConeDegChange,
  spotRange,
  onSpotRangeChange,
  spotFalloff,
  onSpotFalloffChange,
  lightCount,
  activeLightIndex,
  lightNames,
  onSelectLight,
  onAddLight,
  onRemoveLight,
  onRenameLight,
  objectCount,
  activeObjectIndex,
  objectNames,
  onSelectObject,
  onAddObject,
  onRemoveObject,
  onRenameObject,
  onSaveScene,
  onLoadSceneFile,
  onExportCsv,
  onExportPdf,
  onExportScreenshot,
  objectColor,
  onObjectColorChange,
  objectCastShadows,
  onObjectCastShadowsChange,
  objectReceiveShadows,
  onObjectReceiveShadowsChange,
  objectSelfShadows,
  onObjectSelfShadowsChange,
  meshOptions,
  activeMeshId,
  onObjectMeshChange,
  objectSpecular,
  onObjectSpecularChange,
  objectShininess,
  onObjectShininessChange,
  objectRoughness,
  onObjectRoughnessChange
}: ControlPanelProps) {
  const [params, setParams] = useState<ShadowParams>(INITIAL_PARAMS);
  const [modelName, setModelName] = useState<string | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const objectTextureInputRef = useRef<HTMLInputElement | null>(null);
  const floorTextureInputRef = useRef<HTMLInputElement | null>(null);
  const sceneFileInputRef = useRef<HTMLInputElement | null>(null);
  const strings = STRINGS[lang];

  const updateParams = (partial: Partial<ShadowParams>) => {
    const nextParams = { ...params, ...partial };
    setParams(nextParams);
    onParamsChange(nextParams);
  };

  const resetPanel = () => {
    setParams(INITIAL_PARAMS);
    onParamsChange(INITIAL_PARAMS);
    onLightModeChange('sun');
    if (!autoRotate) onToggleAutoRotate();

    onShowFloorChange(true);
    onShowWallsChange(true);
    onFloorSizeChange(10);
    onShowGridChange(true);
    onFloorColorChange('#26282d');
    onWallColorChange('#1f2226');

    onObjectMoveSpeedChange(1.0);
    onLightIntensityChange(1.0);
    onShowLightBeamChange(true);

    onResetScene?.();
    onResetModel?.();
    setModelName(null);
    if (modelInputRef.current) modelInputRef.current.value = '';
  };

  const applyLightingPreset = () => {
    const presetParams: ShadowParams = {
      ...INITIAL_PARAMS,
      method: 'PCF',
      pcfSamples: 16,
      ambientStrength: 0.36,
      exposure: 0.92,
      hemisphereSkyColor: [0.56, 0.62, 0.76],
      hemisphereGroundColor: [0.16, 0.14, 0.13]
    };
    setParams(presetParams);
    onParamsChange(presetParams);
    onLightingPreset?.();
    if (autoRotate) onToggleAutoRotate();
  };

  const handleScenePresetChange = (presetId: keyof typeof SCENE_PRESETS) => {
    const preset = SCENE_PRESETS[presetId];
    if (preset.shadowMethod) {
      const nextParams: ShadowParams = {
        ...params,
        method: preset.shadowMethod
      };
      setParams(nextParams);
      onParamsChange(nextParams);
    }
    onScenePresetChange(presetId);
    if (autoRotate) onToggleAutoRotate();
  };

  const stopSidebarKeyboardActivation = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.getAttribute('data-allow-key-activation') === 'true') return;

    if (
      event.key === ' ' ||
      event.code === 'Space' ||
      event.key === 'Enter' ||
      event.key.startsWith('Arrow') ||
      event.key === 'Shift'
    ) {
      event.stopPropagation();
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
    }
  };

  const blurKeyboardFocusedControl = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.getAttribute('data-allow-key-activation') === 'true') return;
    if (target instanceof HTMLButtonElement) {
      window.requestAnimationFrame(() => target.blur());
    }
  };

  return (
    <div
      style={panelStyle}
      data-ui-panel="true"
      onKeyDownCapture={stopSidebarKeyboardActivation}
      onKeyUpCapture={stopSidebarKeyboardActivation}
      onFocusCapture={blurKeyboardFocusedControl}
    >
      <Header
        autoRotate={autoRotate}
        lang={lang}
        method={params.method}
        strings={strings}
        onLanguageChange={onLanguageChange}
        onToggleAutoRotate={onToggleAutoRotate}
      />

      <ShadowSettings params={params} strings={strings} onUpdate={updateParams} />

      <LightControls
        lang={lang}
        strings={strings}
        lightMode={lightMode}
        onLightModeChange={onLightModeChange}
        lightIntensity={lightIntensity}
        onLightIntensityChange={onLightIntensityChange}
        showLightBeam={showLightBeam}
        onShowLightBeamChange={onShowLightBeamChange}
        lightColor={lightColor}
        onLightColorChange={onLightColorChange}
        spotInnerConeDeg={spotInnerConeDeg}
        onSpotInnerConeDegChange={onSpotInnerConeDegChange}
        spotOuterConeDeg={spotOuterConeDeg}
        onSpotOuterConeDegChange={onSpotOuterConeDegChange}
        spotRange={spotRange}
        onSpotRangeChange={onSpotRangeChange}
        spotFalloff={spotFalloff}
        onSpotFalloffChange={onSpotFalloffChange}
        lightCount={lightCount}
        activeLightIndex={activeLightIndex}
        lightNames={lightNames}
        onSelectLight={onSelectLight}
        onAddLight={onAddLight}
        onRemoveLight={onRemoveLight}
        onRenameLight={onRenameLight}
      />

      <ObjectControls
        lang={lang}
        strings={strings}
        objectCount={objectCount}
        activeObjectIndex={activeObjectIndex}
        objectNames={objectNames}
        onSelectObject={onSelectObject}
        onAddObject={onAddObject}
        onRemoveObject={onRemoveObject}
        onRenameObject={onRenameObject}
        objectColor={objectColor}
        onObjectColorChange={onObjectColorChange}
        objectCastShadows={objectCastShadows}
        onObjectCastShadowsChange={onObjectCastShadowsChange}
        objectReceiveShadows={objectReceiveShadows}
        onObjectReceiveShadowsChange={onObjectReceiveShadowsChange}
        objectSelfShadows={objectSelfShadows}
        onObjectSelfShadowsChange={onObjectSelfShadowsChange}
        meshOptions={meshOptions}
        activeMeshId={activeMeshId}
        onObjectMeshChange={onObjectMeshChange}
        objectSpecular={objectSpecular}
        onObjectSpecularChange={onObjectSpecularChange}
        objectShininess={objectShininess}
        onObjectShininessChange={onObjectShininessChange}
        objectRoughness={objectRoughness}
        onObjectRoughnessChange={onObjectRoughnessChange}
        objectMoveSpeed={objectMoveSpeed}
        onObjectMoveSpeedChange={onObjectMoveSpeedChange}
      />

      <SceneControls
        lang={lang}
        strings={strings}
        showFloor={showFloor}
        showWalls={showWalls}
        floorSize={floorSize}
        showGrid={showGrid}
        floorColor={floorColor}
        wallColor={wallColor}
        modelName={modelName}
        modelInputRef={modelInputRef}
        objectTextureInputRef={objectTextureInputRef}
        floorTextureInputRef={floorTextureInputRef}
        sceneFileInputRef={sceneFileInputRef}
        onModelNameChange={setModelName}
        onShowFloorChange={onShowFloorChange}
        onShowWallsChange={onShowWallsChange}
        onFloorSizeChange={onFloorSizeChange}
        onShowGridChange={onShowGridChange}
        onFloorColorChange={onFloorColorChange}
        onWallColorChange={onWallColorChange}
        onLoadModel={onLoadModel}
        onResetModel={onResetModel}
        onLoadObjectTexture={onLoadObjectTexture}
        onLoadFloorTexture={onLoadFloorTexture}
        activeScenePreset={activeScenePreset}
        onScenePresetChange={handleScenePresetChange}
        onSaveScene={onSaveScene}
        onLoadSceneFile={onLoadSceneFile}
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
        onExportScreenshot={onExportScreenshot}
      />

      <button
        type="button"
        onClick={applyLightingPreset}
        style={{
          ...primaryButtonStyle,
          width: '100%',
          padding: 8,
          marginBottom: 8
        }}
      >
        {lang === 'ru' ? 'Пресет света' : 'Lighting preset'}
      </button>

      <button
        type="button"
        onClick={resetPanel}
        style={{
          ...dangerButtonStyle,
          width: '100%',
          padding: 8,
          marginBottom: 8
        }}
      >
        {strings.resetScene}
      </button>

      <HintsSection
        lang={lang}
        strings={strings}
        isPointerLocked={isPointerLocked}
      />
    </div>
  );
}
