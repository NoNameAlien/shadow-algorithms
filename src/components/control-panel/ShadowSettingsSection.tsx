import { useState } from 'react';
import { SHADOW_METHODS } from './constants';
import { HelpMark, RangeControl, SelectControl } from './FormControls';
import { PanelSection } from './PanelSection';
import { colorInputStyle, subtleButtonStyle } from './styles';
import type { ControlPanelStrings, ShadowDebugMode, ShadowParams } from './types';
import { getAvailableShadowQualityPresets, getShadowQualityPreset } from '../../utils/shadowQuality';

type Props = {
  params: ShadowParams;
  strings: ControlPanelStrings;
  onUpdate: (partial: Partial<ShadowParams>) => void;
  mode?: 'all' | 'scene' | 'debug';
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

const normalizeShadowDebugMode = (mode: ShadowDebugMode | undefined): ShadowDebugMode => {
  if (mode === 'primary') return 'slot0';
  if (mode === 'secondary') return 'slot1';
  return mode ?? 'off';
};

export function ShadowSettingsSection({ params, strings, onUpdate, mode = 'all' }: Props) {
  const isRu = strings.title === 'Настройки теней';
  const [shadowPreviewOpen, setShadowPreviewOpen] = useState(false);
  const showScene = mode !== 'debug';
  const showDebug = mode !== 'scene';
  const isPCF = params.method === 'PCF';
  const isPCSS = params.method === 'PCSS';
  const isVSM = params.method === 'VSM';
  const debugShadowMap = normalizeShadowDebugMode(params.debugShadowMap);
  const shadowDebugOptions = [
    { value: 'off' as const, label: isRu ? 'Выкл.' : 'Off' },
    ...([0, 1, 2, 3, 4, 5, 6, 7] as const).map((slot) => ({
      value: `slot${slot}` as const,
      label: isVSM
        ? isRu ? `Слот ${slot}: моменты VSM` : `Slot ${slot}: VSM moments`
        : isRu ? `Слот ${slot}: глубина` : `Slot ${slot}: depth`
    }))
  ];
  const lightDebugOptions = [
    { value: 'final' as const, label: isRu ? 'Итоговый вид' : 'Final' },
    { value: 'lighting' as const, label: isRu ? 'Только освещение' : 'Lighting only' },
    { value: 'diffuse' as const, label: isRu ? 'Диффузный свет' : 'Diffuse' },
    { value: 'specular' as const, label: isRu ? 'Блики' : 'Specular' },
    { value: 'shadow' as const, label: isRu ? 'Маска теней' : 'Shadow mask' },
    { value: 'normals' as const, label: isRu ? 'Нормали' : 'Normals' },
    { value: 'activeCone' as const, label: isRu ? 'Активный конус' : 'Active cone' },
    { value: 'activeFalloff' as const, label: isRu ? 'Активное затухание' : 'Active falloff' },
    { value: 'activeShadow' as const, label: isRu ? 'Активная тень' : 'Active shadow' }
  ];
  const activeQuality = getShadowQualityPreset(params);
  const qualityPresets = getAvailableShadowQualityPresets(params.method);
  const handleMethodChange = (method: typeof params.method) => {
    if (activeQuality?.id === 'raw' && method !== 'SM') {
      const lowPreset = getAvailableShadowQualityPresets(method).find((preset) => preset.id === 'low');
      onUpdate({ ...lowPreset?.params, method });
      return;
    }

    onUpdate({ method });
  };

  return (
    <>
      {showScene && (
      <>
      <PanelSection title={strings.methodLabel.replace(':', '')} collapsible={false}>
        <SelectControl
          label={strings.methodLabel}
          help={isRu ? 'Алгоритм расчета теней для текущей сцены.' : 'Shadow algorithm used for the current scene.'}
          value={params.method}
          options={SHADOW_METHODS.map((method) => ({
            value: method,
            label: method === 'SM' ? 'Shadow Mapping' : method
          }))}
          onChange={handleMethodChange}
        />

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 5 }}>
            <span style={{ opacity: 0.85 }}>{strings.qualityPreset}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${qualityPresets.length}, minmax(0, 1fr))`, gap: 5 }}>
            {qualityPresets.map((preset) => {
              const isActive = activeQuality?.id === preset.id;
              return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onUpdate(preset.params)}
                style={{
                  ...subtleButtonStyle,
                  padding: '4px 5px',
                  fontSize: 11,
                  borderColor: isActive ? '#6aa8ff' : subtleButtonStyle.borderColor,
                  background: isActive ? 'rgba(68, 132, 220, 0.28)' : subtleButtonStyle.background,
                  color: isActive ? '#f4f8ff' : subtleButtonStyle.color
                }}
              >
                {preset.label[isRu ? 'ru' : 'en']}
              </button>
              );
            })}
          </div>
        </div>
      </PanelSection>

      <PanelSection title={isRu ? 'Детали метода' : 'Method details'} defaultCollapsed>
        <RangeControl
          label={`${strings.shadowMapSize}: ${params.shadowMapSize}`}
          help={isRu ? 'Разрешение shadow map: выше четче, но тяжелее для GPU.' : 'Shadow map resolution: sharper but heavier on the GPU.'}
          min="512"
          max="4096"
          step="512"
          value={params.shadowMapSize}
          onChange={(shadowMapSize) => onUpdate({ shadowMapSize })}
        />

        {!isVSM && (
          <RangeControl
            label={`${strings.bias}: ${params.bias.toFixed(4)}`}
            help={isRu ? 'Сдвиг глубины против acne-артефактов; слишком высокий отрывает тень.' : 'Depth offset against acne artifacts; too high detaches shadows.'}
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
              help={isRu ? 'Радиус размытия PCF в texel shadow map.' : 'PCF blur radius in shadow-map texels.'}
              min="0.5"
              max="5.0"
              step="0.5"
              value={params.pcfRadius || 2.0}
              onChange={(pcfRadius) => onUpdate({ pcfRadius })}
            />

            <SelectControl
              label={`${strings.pcfSamples}: ${params.pcfSamples}`}
              help={isRu ? 'Количество выборок PCF: мягче и дороже при росте.' : 'PCF sample count: softer and more expensive when raised.'}
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
              help={isRu ? 'Виртуальный размер источника для мягких контактных теней PCSS.' : 'Virtual light size for PCSS contact-softening shadows.'}
              min="0.01"
              max="0.2"
              step="0.01"
              value={params.pcssLightSize || 0.05}
              onChange={(pcssLightSize) => onUpdate({ pcssLightSize })}
            />

            <SelectControl
              label={`${strings.pcssBlockerSamples}: ${params.pcssBlockerSearchSamples}`}
              help={isRu ? 'Сколько выборок искать препятствия перед фильтрацией PCSS.' : 'How many samples search blockers before PCSS filtering.'}
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
              help={isRu ? 'Минимальная дисперсия VSM против шумов и протечек.' : 'Minimum VSM variance against noise and light leaking.'}
              min="-6"
              max="-3"
              step="0.1"
              value={Math.log10(params.vsmMinVariance || 0.00001)}
              onChange={(value) => onUpdate({ vsmMinVariance: Math.pow(10, value) })}
            />

            <RangeControl
              label={`${strings.vsmLightBleed}: ${params.vsmLightBleedReduction?.toFixed(2)}`}
              help={isRu ? 'Подавление протечки света в VSM.' : 'Light bleeding reduction for VSM.'}
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

      <PanelSection title={isRu ? 'Свет и окружение' : 'Lighting & environment'} defaultCollapsed>
        <RangeControl
          label={`${strings.shadowStrength} (×${(params.shadowStrength ?? 1.0).toFixed(2)})`}
          help={isRu ? 'Итоговая сила затемнения от теней.' : 'Final darkening strength from shadows.'}
          min="0.0"
          max="2.0"
          step="0.05"
          value={params.shadowStrength ?? 1.0}
          onChange={(shadowStrength) => onUpdate({ shadowStrength })}
        />

        <RangeControl
          label={`${strings.ambientStrength}: ${(params.ambientStrength ?? 0.4).toFixed(2)}`}
          help={isRu ? 'Фоновая подсветка, которая смягчает полностью темные зоны.' : 'Ambient fill that softens fully dark areas.'}
          min="0.0"
          max="0.8"
          step="0.02"
          value={params.ambientStrength ?? 0.4}
          onChange={(ambientStrength) => onUpdate({ ambientStrength })}
        />

        <RangeControl
          label={`${strings.exposure}: ${(params.exposure ?? 0.9).toFixed(2)}`}
          help={isRu ? 'Общая яркость итогового изображения.' : 'Overall brightness of the final image.'}
          min="0.4"
          max="1.5"
          step="0.05"
          value={params.exposure ?? 0.9}
          onChange={(exposure) => onUpdate({ exposure })}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
          <input
            type="color"
            value={rgbToHex(params.hemisphereSkyColor ?? [0.62, 0.68, 0.78])}
            onChange={(event) => onUpdate({ hemisphereSkyColor: hexToRgb(event.target.value) })}
            style={colorInputStyle}
          />
          {strings.skyAmbient}
          <HelpMark text={isRu ? 'Цвет верхней полусферы фонового освещения.' : 'Color of the upper hemisphere ambient light.'} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
          <input
            type="color"
            value={rgbToHex(params.hemisphereGroundColor ?? [0.18, 0.16, 0.14])}
            onChange={(event) => onUpdate({ hemisphereGroundColor: hexToRgb(event.target.value) })}
            style={colorInputStyle}
          />
          {strings.groundAmbient}
          <HelpMark text={isRu ? 'Цвет нижней полусферы фонового освещения.' : 'Color of the lower hemisphere ambient light.'} />
        </label>

      </PanelSection>
      </>
      )}

      {showDebug && (
        <PanelSection title={isRu ? 'Визуальная отладка' : 'Visual debug'} collapsible={false}>
          <SelectControl
            label={strings.lightDebugMode}
            help={isRu ? 'Показывает отдельные составляющие освещения для отладки.' : 'Shows separate lighting components for debugging.'}
            value={params.lightDebugMode ?? 'final'}
            options={lightDebugOptions}
            onChange={(lightDebugMode) => onUpdate({ lightDebugMode })}
          />

          <SelectControl
            label={strings.shadowDebug}
            help={isRu ? 'Выводит карту теней или моменты VSM поверх сцены.' : 'Displays shadow map or VSM moments over the scene.'}
            value={debugShadowMap}
            options={shadowDebugOptions}
            onChange={(debugShadowMap) => onUpdate({ debugShadowMap })}
            marginBottom={8}
          />

          <div style={{ paddingTop: 8, borderTop: '1px solid #2a303c' }}>
            <button
              type="button"
              onClick={() => setShadowPreviewOpen((previous) => !previous)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 0,
                background: 'transparent',
                border: 'none',
                color: '#e6e6e6',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'left'
              }}
            >
              <span>{isRu ? 'Просмотр карты теней' : 'Shadow map preview'}</span>
              <span>{shadowPreviewOpen ? '▴' : '▾'}</span>
            </button>

            {shadowPreviewOpen ? (
              <div style={{ marginTop: 8, display: 'grid', gap: 6, fontSize: 12, color: '#cfd6e4' }}>
                <div
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #343b4a',
                    borderRadius: 6,
                    background: '#252a34'
                  }}
                >
                  {debugShadowMap === 'off'
                    ? isRu ? 'Предпросмотр выключен' : 'Preview is off'
                    : isRu
                      ? `Показывается: ${shadowDebugOptions.find((option) => option.value === debugShadowMap)?.label ?? debugShadowMap}`
                      : `Showing: ${shadowDebugOptions.find((option) => option.value === debugShadowMap)?.label ?? debugShadowMap}`}
                </div>
                <div style={{ opacity: 0.72, lineHeight: 1.35 }}>
                  {isRu
                    ? 'Само изображение рисуется поверх сцены рядом с правой панелью, чтобы не перекрывать метрики производительности.'
                    : 'The image is drawn over the scene next to the right panel so it does not cover performance metrics.'}
                </div>
              </div>
            ) : null}
          </div>
        </PanelSection>
      )}
    </>
  );
}
