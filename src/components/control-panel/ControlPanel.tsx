import { useRef, useState } from 'react';
import { AssetsSection } from './AssetsSection';
import { INITIAL_PARAMS, STRINGS } from './constants';
import { EntitySelector } from './EntitySelector';
import { EnvironmentSection, ObjectMoveSpeedSection } from './EnvironmentSection';
import { Header } from './Header';
import { HintsSection } from './HintsSection';
import { LightModeSection, LightSettingsSection } from './LightSettingsSection';
import { ObjectParamsSection } from './ObjectParamsSection';
import { SceneActions } from './SceneActions';
import { ShadowSettingsSection } from './ShadowSettingsSection';
import { panelStyle } from './styles';
import type { ControlPanelProps, ShadowParams } from './types';

export function ControlPanel({
  onParamsChange,
  onLoadModel,
  onResetScene,
  onResetModel,
  onLoadObjectTexture,
  onLoadFloorTexture,
  fps = 0,
  isPointerLocked = false,
  lightMode,
  onLightModeChange,
  lang,
  onLanguageChange,
  autoRotate,
  onToggleAutoRotate,
  showFloor,
  showWalls,
  floorColor,
  wallColor,
  onShowFloorChange,
  onShowWallsChange,
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
  lightCastShadows,
  onLightCastShadowsChange,
  lightCount,
  activeLightIndex,
  onSelectLight,
  onAddLight,
  onRemoveLight,
  objectCount,
  activeObjectIndex,
  onSelectObject,
  onAddObject,
  onRemoveObject,
  onSaveScene,
  onLoadSceneFile,
  objectColor,
  onObjectColorChange,
  objectCastShadows,
  onObjectCastShadowsChange,
  objectReceiveShadows,
  onObjectReceiveShadowsChange,
  meshOptions,
  activeMeshId,
  onObjectMeshChange,
  objectSpecular,
  onObjectSpecularChange,
  objectShininess,
  onObjectShininessChange
}: ControlPanelProps) {
  const [params, setParams] = useState<ShadowParams>(INITIAL_PARAMS);
  const [modelName, setModelName] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
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

  return (
    <div style={panelStyle}>
      <Header
        autoRotate={autoRotate}
        lang={lang}
        method={params.method}
        strings={strings}
        onLanguageChange={onLanguageChange}
        onToggleAutoRotate={onToggleAutoRotate}
      />

      <EntitySelector
        label={strings.lightsLabel}
        prefix="L"
        count={lightCount}
        activeIndex={activeLightIndex}
        lang={lang}
        addTitle={lang === 'ru' ? 'Добавить источник' : 'Add light'}
        removeTitle={lang === 'ru' ? 'Удалить источник (кроме первого)' : 'Remove light (except first)'}
        onSelect={onSelectLight}
        onAdd={onAddLight}
        onRemove={onRemoveLight}
      />

      <EntitySelector
        label={strings.objectsLabel}
        prefix="O"
        count={objectCount}
        activeIndex={activeObjectIndex}
        lang={lang}
        addTitle={lang === 'ru' ? 'Добавить объект' : 'Add object'}
        removeTitle={lang === 'ru' ? 'Удалить объект (кроме первого)' : 'Remove object (except first)'}
        onSelect={onSelectObject}
        onAdd={onAddObject}
        onRemove={onRemoveObject}
      />

      <ObjectParamsSection
        lang={lang}
        objectColor={objectColor}
        meshOptions={meshOptions}
        activeMeshId={activeMeshId}
        objectSpecular={objectSpecular}
        objectShininess={objectShininess}
        objectCastShadows={objectCastShadows}
        objectReceiveShadows={objectReceiveShadows}
        onObjectColorChange={onObjectColorChange}
        onObjectMeshChange={onObjectMeshChange}
        onObjectSpecularChange={onObjectSpecularChange}
        onObjectShininessChange={onObjectShininessChange}
        onObjectCastShadowsChange={onObjectCastShadowsChange}
        onObjectReceiveShadowsChange={onObjectReceiveShadowsChange}
      />

      <LightModeSection strings={strings} lightMode={lightMode} onLightModeChange={onLightModeChange} />

      <LightSettingsSection
        lang={lang}
        strings={strings}
        lightIntensity={lightIntensity}
        lightColor={lightColor}
        lightCastShadows={lightCastShadows}
        showLightBeam={showLightBeam}
        onLightIntensityChange={onLightIntensityChange}
        onLightColorChange={onLightColorChange}
        onLightCastShadowsChange={onLightCastShadowsChange}
        onShowLightBeamChange={onShowLightBeamChange}
      />

      <ShadowSettingsSection params={params} strings={strings} onUpdate={updateParams} />

      <ObjectMoveSpeedSection
        strings={strings}
        objectMoveSpeed={objectMoveSpeed}
        onObjectMoveSpeedChange={onObjectMoveSpeedChange}
      />

      <EnvironmentSection
        lang={lang}
        strings={strings}
        showFloor={showFloor}
        showWalls={showWalls}
        floorColor={floorColor}
        wallColor={wallColor}
        onShowFloorChange={onShowFloorChange}
        onShowWallsChange={onShowWallsChange}
        onFloorColorChange={onFloorColorChange}
        onWallColorChange={onWallColorChange}
      />

      <AssetsSection
        lang={lang}
        strings={strings}
        modelName={modelName}
        modelInputRef={modelInputRef}
        objectTextureInputRef={objectTextureInputRef}
        floorTextureInputRef={floorTextureInputRef}
        onModelNameChange={setModelName}
        onLoadModel={onLoadModel}
        onResetModel={onResetModel}
        onLoadObjectTexture={onLoadObjectTexture}
        onLoadFloorTexture={onLoadFloorTexture}
      />

      <SceneActions
        lang={lang}
        sceneFileInputRef={sceneFileInputRef}
        onSaveScene={onSaveScene}
        onLoadSceneFile={onLoadSceneFile}
      />

      <button
        type="button"
        onClick={resetPanel}
        style={{
          width: '100%',
          padding: 8,
          marginBottom: 8,
          background: '#c92a2a',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600
        }}
      >
        {strings.resetScene}
      </button>

      <HintsSection
        lang={lang}
        strings={strings}
        showHints={showHints}
        isPointerLocked={isPointerLocked}
        fps={fps}
        onToggleHints={() => setShowHints((previous) => !previous)}
      />
    </div>
  );
}
