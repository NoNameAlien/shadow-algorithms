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
  | 'lightShadowSlots'
  | 'activeLightDiagnostics'
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
        badges={lightShadowSlots.map((slot) => (slot === null ? (lang === 'ru' ? 'нет' : 'none') : `S${slot}`))}
        lang={lang}
        addTitle={lang === 'ru' ? 'Добавить источник' : 'Add light'}
        removeTitle={lang === 'ru' ? 'Удалить источник (кроме первого)' : 'Remove light (except first)'}
        maxCount={8}
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
        showLightBeam={showLightBeam}
        spotInnerConeDeg={spotInnerConeDeg}
        spotOuterConeDeg={spotOuterConeDeg}
        spotRange={spotRange}
        spotFalloff={spotFalloff}
        shadowSlot={lightShadowSlots[activeLightIndex] ?? null}
        diagnostics={activeLightDiagnostics}
        onLightModeChange={onLightModeChange}
        onLightIntensityChange={onLightIntensityChange}
        onLightColorChange={onLightColorChange}
        onShowLightBeamChange={onShowLightBeamChange}
        onSpotInnerConeDegChange={onSpotInnerConeDegChange}
        onSpotOuterConeDegChange={onSpotOuterConeDegChange}
        onSpotRangeChange={onSpotRangeChange}
        onSpotFalloffChange={onSpotFalloffChange}
      />
    </>
  );
}
