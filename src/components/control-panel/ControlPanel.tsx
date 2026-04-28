import { useRef, useState } from 'react';
import { INITIAL_PARAMS, STRINGS } from './constants';
import { Header } from './Header';
import { HintsSection } from './HintsSection';
import { LightControls } from './LightControls';
import { ObjectControls } from './ObjectControls';
import { SceneControls } from './SceneControls';
import { ShadowSettings } from './ShadowSettings';
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
        lightCastShadows={lightCastShadows}
        onLightCastShadowsChange={onLightCastShadowsChange}
        lightCount={lightCount}
        activeLightIndex={activeLightIndex}
        onSelectLight={onSelectLight}
        onAddLight={onAddLight}
        onRemoveLight={onRemoveLight}
      />

      <ObjectControls
        lang={lang}
        strings={strings}
        objectCount={objectCount}
        activeObjectIndex={activeObjectIndex}
        onSelectObject={onSelectObject}
        onAddObject={onAddObject}
        onRemoveObject={onRemoveObject}
        objectColor={objectColor}
        onObjectColorChange={onObjectColorChange}
        objectCastShadows={objectCastShadows}
        onObjectCastShadowsChange={onObjectCastShadowsChange}
        objectReceiveShadows={objectReceiveShadows}
        onObjectReceiveShadowsChange={onObjectReceiveShadowsChange}
        meshOptions={meshOptions}
        activeMeshId={activeMeshId}
        onObjectMeshChange={onObjectMeshChange}
        objectSpecular={objectSpecular}
        onObjectSpecularChange={onObjectSpecularChange}
        objectShininess={objectShininess}
        onObjectShininessChange={onObjectShininessChange}
        objectMoveSpeed={objectMoveSpeed}
        onObjectMoveSpeedChange={onObjectMoveSpeedChange}
      />

      <ShadowSettings params={params} strings={strings} onUpdate={updateParams} />

      <SceneControls
        lang={lang}
        strings={strings}
        showFloor={showFloor}
        showWalls={showWalls}
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
        onFloorColorChange={onFloorColorChange}
        onWallColorChange={onWallColorChange}
        onLoadModel={onLoadModel}
        onResetModel={onResetModel}
        onLoadObjectTexture={onLoadObjectTexture}
        onLoadFloorTexture={onLoadFloorTexture}
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
