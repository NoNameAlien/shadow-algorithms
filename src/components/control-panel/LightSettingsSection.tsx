import { LIGHT_MODES } from './constants';
import { RangeControl } from './FormControls';
import { PanelSection } from './PanelSection';
import { buttonStyle, colorInputStyle } from './styles';
import type { ControlPanelStrings, Lang, LightMode } from './types';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  lightMode: LightMode;
  lightIntensity: number;
  lightColor: string;
  lightCastShadows: boolean;
  showLightBeam: boolean;
  spotInnerConeDeg: number;
  spotOuterConeDeg: number;
  spotRange: number;
  spotFalloff: number;
  onLightModeChange: (mode: LightMode) => void;
  onLightIntensityChange: (value: number) => void;
  onLightColorChange: (hex: string) => void;
  onLightCastShadowsChange: (value: boolean) => void;
  onShowLightBeamChange: (value: boolean) => void;
  onSpotInnerConeDegChange: (value: number) => void;
  onSpotOuterConeDegChange: (value: number) => void;
  onSpotRangeChange: (value: number) => void;
  onSpotFalloffChange: (value: number) => void;
};

export function LightModeSection({ strings, lightMode, onLightModeChange }: Pick<Props, 'strings' | 'lightMode' | 'onLightModeChange'>) {
  return (
    <PanelSection>
      <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.85 }}>
        {strings.lightModeLabel}: <span style={{ fontWeight: 600 }}>{lightMode.toUpperCase()}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {LIGHT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onLightModeChange(mode)}
            style={{
              ...buttonStyle,
              flex: 1,
              padding: '4px 6px',
              fontSize: 13,
              background: lightMode === mode ? '#3b5bdb' : '#252a34'
            }}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>
    </PanelSection>
  );
}

export function LightSettingsSection({
  lang,
  strings,
  lightIntensity,
  lightColor,
  lightCastShadows,
  showLightBeam,
  spotInnerConeDeg,
  spotOuterConeDeg,
  spotRange,
  spotFalloff,
  onLightIntensityChange,
  onLightColorChange,
  onLightCastShadowsChange,
  onShowLightBeamChange,
  onSpotInnerConeDegChange,
  onSpotOuterConeDegChange,
  onSpotRangeChange,
  onSpotFalloffChange
}: Omit<Props, 'lightMode' | 'onLightModeChange'>) {
  return (
    <PanelSection>
      <RangeControl
        label={`${strings.lightIntensity}: ${lightIntensity.toFixed(2)}`}
        min="0.0"
        max="3.0"
        step="0.1"
        value={lightIntensity}
        onChange={onLightIntensityChange}
        marginBottom={6}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{lang === 'ru' ? 'Цвет света' : 'Light color'}</span>
        <input
          type="color"
          value={lightColor}
          onChange={(event) => onLightColorChange(event.target.value)}
          style={colorInputStyle}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={lightCastShadows}
          onChange={(event) => onLightCastShadowsChange(event.target.checked)}
        />
        {lang === 'ru' ? 'Этот источник кидает тени' : 'This light casts shadows'}
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={showLightBeam}
          onChange={(event) => onShowLightBeamChange(event.target.checked)}
        />
        {strings.lightBeamShow}
      </label>

      <div style={{ fontSize: 13, marginTop: 8, marginBottom: 5, opacity: 0.85 }}>
        {lang === 'ru' ? 'Параметры прожектора' : 'Spot light params'}
      </div>

      <RangeControl
        label={lang === 'ru' ? `Внутренний конус: ${spotInnerConeDeg.toFixed(0)}°` : `Inner cone: ${spotInnerConeDeg.toFixed(0)}°`}
        min={1}
        max={80}
        step={1}
        value={spotInnerConeDeg}
        onChange={onSpotInnerConeDegChange}
        marginBottom={6}
      />

      <RangeControl
        label={lang === 'ru' ? `Внешний конус: ${spotOuterConeDeg.toFixed(0)}°` : `Outer cone: ${spotOuterConeDeg.toFixed(0)}°`}
        min={2}
        max={90}
        step={1}
        value={spotOuterConeDeg}
        onChange={onSpotOuterConeDegChange}
        marginBottom={6}
      />

      <RangeControl
        label={lang === 'ru' ? `Дальность: ${spotRange.toFixed(1)}` : `Range: ${spotRange.toFixed(1)}`}
        min={2}
        max={30}
        step={0.5}
        value={spotRange}
        onChange={onSpotRangeChange}
        marginBottom={6}
      />

      <RangeControl
        label={lang === 'ru' ? `Затухание: ${spotFalloff.toFixed(2)}` : `Falloff: ${spotFalloff.toFixed(2)}`}
        min={0.2}
        max={4}
        step={0.1}
        value={spotFalloff}
        onChange={onSpotFalloffChange}
        marginBottom={0}
      />
    </PanelSection>
  );
}
