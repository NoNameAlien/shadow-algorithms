import { SHADOW_METHODS } from './constants';
import { RangeControl, SelectControl } from './FormControls';
import { PanelSection } from './PanelSection';
import type { ControlPanelStrings, ShadowParams } from './types';

type Props = {
  params: ShadowParams;
  strings: ControlPanelStrings;
  onUpdate: (partial: Partial<ShadowParams>) => void;
};

export function ShadowSettingsSection({ params, strings, onUpdate }: Props) {
  const isPCF = params.method === 'PCF';
  const isPCSS = params.method === 'PCSS';
  const isVSM = params.method === 'VSM';

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
          marginBottom={0}
        />
      </PanelSection>
    </>
  );
}
