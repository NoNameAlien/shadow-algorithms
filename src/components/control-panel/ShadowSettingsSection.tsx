import { SHADOW_METHODS } from './constants';
import { RangeControl, SelectControl } from './FormControls';
import { PanelSection } from './PanelSection';
import { colorInputStyle } from './styles';
import type { ControlPanelStrings, ShadowParams } from './types';

type Props = {
  params: ShadowParams;
  strings: ControlPanelStrings;
  onUpdate: (partial: Partial<ShadowParams>) => void;
};

const rgbToHex = (rgb: [number, number, number]) =>
  `#${rgb.map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join('')}`;

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255
  ];
};

export function ShadowSettingsSection({ params, strings, onUpdate }: Props) {
  const isPCF = params.method === 'PCF';
  const isPCSS = params.method === 'PCSS';
  const isVSM = params.method === 'VSM';
  const debugShadowMap = params.debugShadowMap === 'secondary' && params.method !== 'SM'
    ? 'primary'
    : params.debugShadowMap ?? 'off';
  const shadowDebugOptions = [
    { value: 'off' as const, label: 'Off' },
    {
      value: 'primary' as const,
      label: isVSM ? 'VSM moments' : 'Primary depth'
    },
    ...(params.method === 'SM' ? [{ value: 'secondary' as const, label: 'Secondary depth' }] : [])
  ];
  const lightDebugOptions = [
    { value: 'final' as const, label: 'Final' },
    { value: 'lighting' as const, label: 'Lighting only' },
    { value: 'diffuse' as const, label: 'Diffuse' },
    { value: 'specular' as const, label: 'Specular' },
    { value: 'shadow' as const, label: 'Shadow mask' },
    { value: 'normals' as const, label: 'Normals' }
  ];
  const qualityPresets = [
    { label: 'Low', params: { shadowMapSize: 1024, bias: 0.006, pcfRadius: 1.5, pcfSamples: 4, pcssBlockerSearchSamples: 8, vsmLightBleedReduction: 0.5 } },
    { label: 'Medium', params: { shadowMapSize: 2048, bias: 0.003, pcfRadius: 2.5, pcfSamples: 8, pcssBlockerSearchSamples: 8, vsmLightBleedReduction: 0.4 } },
    { label: 'High', params: { shadowMapSize: 3072, bias: 0.002, pcfRadius: 3, pcfSamples: 16, pcssBlockerSearchSamples: 16, vsmLightBleedReduction: 0.35 } },
    { label: 'Ultra', params: { shadowMapSize: 4096, bias: 0.0015, pcfRadius: 4, pcfSamples: 32, pcssBlockerSearchSamples: 32, vsmLightBleedReduction: 0.3 } }
  ];

  return (
    <>
      <PanelSection>
        <SelectControl
          label={strings.methodLabel}
          value={params.method}
          options={SHADOW_METHODS.map((method) => ({
            value: method,
            label: method === 'SM' ? 'Shadow Mapping' : method
          }))}
          onChange={(method) => onUpdate({ method })}
        />

        <RangeControl
          label={`${strings.shadowMapSize}: ${params.shadowMapSize}`}
          min="512"
          max="4096"
          step="512"
          value={params.shadowMapSize}
          onChange={(shadowMapSize) => onUpdate({ shadowMapSize })}
        />

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, marginBottom: 5, opacity: 0.85 }}>{strings.qualityPreset}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 5 }}>
            {qualityPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onUpdate(preset.params)}
                style={{ padding: '4px 5px', fontSize: 11, borderRadius: 5, border: '1px solid #343b4a', background: '#252a34', color: '#e6e6e6', cursor: 'pointer' }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {!isVSM && (
          <RangeControl
            label={`${strings.bias}: ${params.bias.toFixed(4)}`}
            min="0.001"
            max="0.02"
            step="0.001"
            value={params.bias}
            onChange={(bias) => onUpdate({ bias })}
          />
        )}

        {isPCF && (
          <>
            <RangeControl
              label={`${strings.pcfRadius}: ${params.pcfRadius?.toFixed(1)} texels`}
              min="0.5"
              max="5.0"
              step="0.5"
              value={params.pcfRadius || 2.0}
              onChange={(pcfRadius) => onUpdate({ pcfRadius })}
            />

            <SelectControl
              label={`${strings.pcfSamples}: ${params.pcfSamples}`}
              value={params.pcfSamples ?? 8}
              options={[4, 8, 16, 32].map((value) => ({ value, label: String(value) }))}
              onChange={(pcfSamples) => onUpdate({ pcfSamples })}
            />
          </>
        )}

        {isPCSS && (
          <>
            <RangeControl
              label={`${strings.pcssLightSize}: ${params.pcssLightSize?.toFixed(3)}`}
              min="0.01"
              max="0.2"
              step="0.01"
              value={params.pcssLightSize || 0.05}
              onChange={(pcssLightSize) => onUpdate({ pcssLightSize })}
            />

            <SelectControl
              label={`${strings.pcssBlockerSamples}: ${params.pcssBlockerSearchSamples}`}
              value={params.pcssBlockerSearchSamples ?? 8}
              options={[8, 16, 32].map((value) => ({ value, label: String(value) }))}
              onChange={(pcssBlockerSearchSamples) => onUpdate({ pcssBlockerSearchSamples })}
              marginBottom={0}
            />
          </>
        )}

        {isVSM && (
          <>
            <RangeControl
              label={`${strings.vsmMinVariance}: ${params.vsmMinVariance?.toExponential(2)}`}
              min="-6"
              max="-3"
              step="0.1"
              value={Math.log10(params.vsmMinVariance || 0.00001)}
              onChange={(value) => onUpdate({ vsmMinVariance: Math.pow(10, value) })}
            />

            <RangeControl
              label={`${strings.vsmLightBleed}: ${params.vsmLightBleedReduction?.toFixed(2)}`}
              min="0.0"
              max="0.8"
              step="0.05"
              value={params.vsmLightBleedReduction || 0.3}
              onChange={(vsmLightBleedReduction) => onUpdate({ vsmLightBleedReduction })}
              marginBottom={0}
            />
          </>
        )}
      </PanelSection>

      <PanelSection>
        <RangeControl
          label={`${strings.shadowStrength} (×${(params.shadowStrength ?? 1.0).toFixed(2)})`}
          min="0.0"
          max="2.0"
          step="0.05"
          value={params.shadowStrength ?? 1.0}
          onChange={(shadowStrength) => onUpdate({ shadowStrength })}
        />

        <RangeControl
          label={`${strings.ambientStrength}: ${(params.ambientStrength ?? 0.4).toFixed(2)}`}
          min="0.0"
          max="0.8"
          step="0.02"
          value={params.ambientStrength ?? 0.4}
          onChange={(ambientStrength) => onUpdate({ ambientStrength })}
        />

        <RangeControl
          label={`${strings.exposure}: ${(params.exposure ?? 0.9).toFixed(2)}`}
          min="0.4"
          max="1.5"
          step="0.05"
          value={params.exposure ?? 0.9}
          onChange={(exposure) => onUpdate({ exposure })}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13 }}>{strings.skyAmbient}</span>
          <input
            type="color"
            value={rgbToHex(params.hemisphereSkyColor ?? [0.62, 0.68, 0.78])}
            onChange={(event) => onUpdate({ hemisphereSkyColor: hexToRgb(event.target.value) })}
            style={colorInputStyle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13 }}>{strings.groundAmbient}</span>
          <input
            type="color"
            value={rgbToHex(params.hemisphereGroundColor ?? [0.18, 0.16, 0.14])}
            onChange={(event) => onUpdate({ hemisphereGroundColor: hexToRgb(event.target.value) })}
            style={colorInputStyle}
          />
        </div>

        <SelectControl
          label={strings.lightDebugMode}
          value={params.lightDebugMode ?? 'final'}
          options={lightDebugOptions}
          onChange={(lightDebugMode) => onUpdate({ lightDebugMode })}
        />

        <SelectControl
          label={strings.shadowDebug}
          value={debugShadowMap}
          options={shadowDebugOptions}
          onChange={(debugShadowMap) => onUpdate({ debugShadowMap })}
          marginBottom={0}
        />
      </PanelSection>
    </>
  );
}
