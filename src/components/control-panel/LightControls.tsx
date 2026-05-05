import { EntitySelector } from './EntitySelector';
import { LightSettingsSection } from './LightSettingsSection';
import type { ControlPanelProps, ControlPanelStrings, Lang } from './types';

type Props = Pick<
  ControlPanelProps,
  | 'lightMode'
  | 'onLightModeChange'
  | 'lightIntensity'
  | 'onLightIntensityChange'
  | 'showLightBeam'
  | 'onShowLightBeamChange'
  | 'lightColor'
  | 'onLightColorChange'
  | 'lightCastShadows'
  | 'onLightCastShadowsChange'
  | 'spotInnerConeDeg'
  | 'onSpotInnerConeDegChange'
  | 'spotOuterConeDeg'
  | 'onSpotOuterConeDegChange'
  | 'spotRange'
  | 'onSpotRangeChange'
  | 'spotFalloff'
  | 'onSpotFalloffChange'
  | 'lightCount'
  | 'activeLightIndex'
  | 'lightNames'
  | 'onSelectLight'
  | 'onAddLight'
  | 'onRemoveLight'
  | 'onRenameLight'
> & {
  lang: Lang;
  strings: ControlPanelStrings;
};

export function LightControls({
  lang,
  strings,
  lightMode,
  onLightModeChange,
  lightIntensity,
  onLightIntensityChange,
  showLightBeam,
  onShowLightBeamChange,
  lightColor,
  onLightColorChange,
  lightCastShadows,
  onLightCastShadowsChange,
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
  onRenameLight
}: Props) {
  return (
    <>
      <EntitySelector
        label={strings.lightsLabel}
        prefix="L"
        count={lightCount}
        activeIndex={activeLightIndex}
        names={lightNames}
        lang={lang}
        addTitle={lang === 'ru' ? 'Добавить источник' : 'Add light'}
        removeTitle={lang === 'ru' ? 'Удалить источник (кроме первого)' : 'Remove light (except first)'}
        onSelect={onSelectLight}
        onAdd={onAddLight}
        onRemove={onRemoveLight}
        onRename={onRenameLight}
      />

      <LightSettingsSection
        lang={lang}
        strings={strings}
        lightMode={lightMode}
        lightIntensity={lightIntensity}
        lightColor={lightColor}
        lightCastShadows={lightCastShadows}
        showLightBeam={showLightBeam}
        spotInnerConeDeg={spotInnerConeDeg}
        spotOuterConeDeg={spotOuterConeDeg}
        spotRange={spotRange}
        spotFalloff={spotFalloff}
        onLightModeChange={onLightModeChange}
        onLightIntensityChange={onLightIntensityChange}
        onLightColorChange={onLightColorChange}
        onLightCastShadowsChange={onLightCastShadowsChange}
        onShowLightBeamChange={onShowLightBeamChange}
        onSpotInnerConeDegChange={onSpotInnerConeDegChange}
        onSpotOuterConeDegChange={onSpotOuterConeDegChange}
        onSpotRangeChange={onSpotRangeChange}
        onSpotFalloffChange={onSpotFalloffChange}
      />
    </>
  );
}
