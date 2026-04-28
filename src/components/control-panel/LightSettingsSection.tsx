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
  onLightModeChange: (mode: LightMode) => void;
  onLightIntensityChange: (value: number) => void;
  onLightColorChange: (hex: string) => void;
  onLightCastShadowsChange: (value: boolean) => void;
  onShowLightBeamChange: (value: boolean) => void;
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
  onLightIntensityChange,
  onLightColorChange,
  onLightCastShadowsChange,
  onShowLightBeamChange
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
    </PanelSection>
  );
}
