import type { Dispatch, RefObject, SetStateAction } from 'react';
import { AssetsSection } from './AssetsSection';
import { EnvironmentSection } from './EnvironmentSection';
import { SceneActions } from './SceneActions';
import type { ControlPanelProps, ControlPanelStrings, Lang } from './types';

type Props = Pick<
  ControlPanelProps,
  | 'showFloor'
  | 'showWalls'
  | 'floorSize'
  | 'showGrid'
  | 'floorColor'
  | 'wallColor'
  | 'onShowFloorChange'
  | 'onShowWallsChange'
  | 'onFloorSizeChange'
  | 'onShowGridChange'
  | 'onFloorColorChange'
  | 'onWallColorChange'
  | 'onLoadModel'
  | 'onResetModel'
  | 'onLoadObjectTexture'
  | 'onLoadFloorTexture'
  | 'onSaveScene'
  | 'onLoadSceneFile'
  | 'activeScenePreset'
  | 'onScenePresetChange'
  | 'onExportCsv'
  | 'onExportPdf'
  | 'onExportScreenshot'
  | 'onRunBenchmark'
  | 'isBenchmarkRunning'
> & {
  lang: Lang;
  strings: ControlPanelStrings;
  modelName: string | null;
  modelInputRef: RefObject<HTMLInputElement | null>;
  objectTextureInputRef: RefObject<HTMLInputElement | null>;
  floorTextureInputRef: RefObject<HTMLInputElement | null>;
  sceneFileInputRef: RefObject<HTMLInputElement | null>;
  onModelNameChange: Dispatch<SetStateAction<string | null>>;
};

export function SceneControls({
  lang,
  strings,
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
  modelName,
  modelInputRef,
  objectTextureInputRef,
  floorTextureInputRef,
  sceneFileInputRef,
  onModelNameChange,
  onLoadModel,
  onResetModel,
  onLoadObjectTexture,
  onLoadFloorTexture,
  onSaveScene,
  onLoadSceneFile,
  activeScenePreset,
  onScenePresetChange,
  onExportCsv,
  onExportPdf,
  onExportScreenshot,
  onRunBenchmark,
  isBenchmarkRunning
}: Props) {
  return (
    <>
      <EnvironmentSection
        lang={lang}
        strings={strings}
        showFloor={showFloor}
        showWalls={showWalls}
        floorSize={floorSize}
        showGrid={showGrid}
        floorColor={floorColor}
        wallColor={wallColor}
        onShowFloorChange={onShowFloorChange}
        onShowWallsChange={onShowWallsChange}
        onFloorSizeChange={onFloorSizeChange}
        onShowGridChange={onShowGridChange}
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
        onModelNameChange={onModelNameChange}
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
        activeScenePreset={activeScenePreset}
        onScenePresetChange={onScenePresetChange}
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
        onExportScreenshot={onExportScreenshot}
        onRunBenchmark={onRunBenchmark}
        isBenchmarkRunning={isBenchmarkRunning}
      />
    </>
  );
}
