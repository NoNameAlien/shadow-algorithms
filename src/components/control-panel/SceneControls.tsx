import type { Dispatch, RefObject, SetStateAction } from 'react';
import { AssetsSection } from './AssetsSection';
import { EnvironmentSection } from './EnvironmentSection';
import { SceneActions } from './SceneActions';
import type { ControlPanelProps, ControlPanelStrings, Lang } from './types';

type Props = Pick<
  ControlPanelProps,
  | 'showFloor'
  | 'showWalls'
  | 'floorColor'
  | 'wallColor'
  | 'onShowFloorChange'
  | 'onShowWallsChange'
  | 'onFloorColorChange'
  | 'onWallColorChange'
  | 'onLoadModel'
  | 'onResetModel'
  | 'onLoadObjectTexture'
  | 'onLoadFloorTexture'
  | 'onSaveScene'
  | 'onLoadSceneFile'
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
  floorColor,
  wallColor,
  onShowFloorChange,
  onShowWallsChange,
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
  onLoadSceneFile
}: Props) {
  return (
    <>
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
      />
    </>
  );
}
