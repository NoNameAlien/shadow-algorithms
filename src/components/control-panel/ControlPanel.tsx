import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { INITIAL_PARAMS, STRINGS } from './constants';
import { SCENE_PRESETS } from '../../engine/presets';
import { Header } from './Header';
import { HintsSection } from './HintsSection';
import { LightDiagnosticsSection } from './LightSettingsSection';
import { LightControls } from './LightControls';
import { ObjectControls } from './ObjectControls';
import { PerformanceMetricsSection } from './PerformanceMetricsSection';
import { SceneControls } from './SceneControls';
import { ShadowSettings } from './ShadowSettings';
import { dangerButtonStyle, panelStyle, subtleButtonStyle } from './styles';
import type { ControlPanelProps, ShadowParams } from './types';

export function ControlPanel({
  onParamsChange,
  onLoadModel,
  onResetScene,
  onResetModel,
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
  sharedRotationCenter,
  onSharedRotationCenterChange,
  performanceMetrics,
  onResetPerformanceMetrics,
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
  lightShadowSlots,
  activeLightDiagnostics,
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
  onRunBenchmark,
  isBenchmarkRunning,
  objectColor,
  onObjectColorChange,
  objectScale,
  onObjectScaleChange,
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
  const [activeTab, setActiveTab] = useState<'scene' | 'debug'>('scene');
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
    onSharedRotationCenterChange(false);

    onResetScene?.();
    onResetModel?.();
    setModelName(null);
    if (modelInputRef.current) modelInputRef.current.value = '';
  };

  const handleScenePresetChange = (presetId: keyof typeof SCENE_PRESETS) => {
    const preset = SCENE_PRESETS[presetId];
    if (preset.shadowMethod || preset.shadowParams) {
      const nextParams: ShadowParams = {
        ...params,
        ...preset.shadowParams,
        method: preset.shadowMethod ?? preset.shadowParams?.method ?? params.method
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
        sharedRotationCenter={sharedRotationCenter}
        lang={lang}
        method={params.method}
        strings={strings}
        onLanguageChange={onLanguageChange}
        onToggleAutoRotate={onToggleAutoRotate}
        onSharedRotationCenterChange={onSharedRotationCenterChange}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {(['scene', 'debug'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              ...subtleButtonStyle,
              padding: '6px 8px',
              fontSize: 13,
              fontWeight: 700,
              background: activeTab === tab ? '#3b5bdb' : subtleButtonStyle.background,
              borderColor: activeTab === tab ? '#6aa8ff' : subtleButtonStyle.borderColor
            }}
          >
            {tab === 'scene'
              ? lang === 'ru' ? 'Сцена' : 'Scene'
              : lang === 'ru' ? 'Дебаг' : 'Debug'}
          </button>
        ))}
      </div>

      {activeTab === 'scene' ? (
        <>
          <ShadowSettings params={params} strings={strings} onUpdate={updateParams} mode="scene" />

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
            lightShadowSlots={lightShadowSlots}
            activeLightDiagnostics={activeLightDiagnostics}
            onSelectLight={onSelectLight}
            onAddLight={onAddLight}
            onRemoveLight={onRemoveLight}
            onRenameLight={onRenameLight}
            diagnosticsPlacement="hidden"
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
        objectScale={objectScale}
        onObjectScaleChange={onObjectScaleChange}
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
        onRunBenchmark={onRunBenchmark}
        isBenchmarkRunning={isBenchmarkRunning}
          />
        </>
      ) : (
        <>
          <ShadowSettings params={params} strings={strings} onUpdate={updateParams} mode="debug" />
          <LightDiagnosticsSection
            lang={lang}
            diagnostics={activeLightDiagnostics}
          />
          <PerformanceMetricsSection
            lang={lang}
            strings={strings}
            metrics={performanceMetrics}
            onReset={onResetPerformanceMetrics}
          />
        </>
      )}

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
