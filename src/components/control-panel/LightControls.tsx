import { EntitySelector } from './EntitySelector';
import { LightModeSection, LightSettingsSection } from './LightSettingsSection';
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
  | 'lightCount'
  | 'activeLightIndex'
  | 'onSelectLight'
  | 'onAddLight'
  | 'onRemoveLight'
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
  lightCount,
  activeLightIndex,
  onSelectLight,
  onAddLight,
  onRemoveLight
}: Props) {
  return (
    <>
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
    </>
  );
}
