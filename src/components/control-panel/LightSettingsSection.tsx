import { useState } from 'react';
import { LIGHT_MODES } from './constants';
import { HelpMark, RangeControl } from './FormControls';
import { PanelSection } from './PanelSection';
import { buttonStyle, colorInputStyle } from './styles';
import type { ControlPanelStrings, Lang, LightDiagnostics, LightMode } from './types';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  lightMode: LightMode;
  lightIntensity: number;
  lightColor: string;
  showLightBeam: boolean;
  spotInnerConeDeg: number;
  spotOuterConeDeg: number;
  spotRange: number;
  spotFalloff: number;
  shadowSlot: number | null;
  diagnostics: LightDiagnostics;
  onLightModeChange: (mode: LightMode) => void;
  onLightIntensityChange: (value: number) => void;
  onLightColorChange: (hex: string) => void;
  onShowLightBeamChange: (value: boolean) => void;
  onSpotInnerConeDegChange: (value: number) => void;
  onSpotOuterConeDegChange: (value: number) => void;
  onSpotRangeChange: (value: number) => void;
  onSpotFalloffChange: (value: number) => void;
};

export function LightSettingsSection({
  lang,
  strings,
  lightMode,
  lightIntensity,
  lightColor,
  showLightBeam,
  spotInnerConeDeg,
  spotOuterConeDeg,
  spotRange,
  spotFalloff,
  shadowSlot,
  diagnostics,
  onLightModeChange,
  onLightIntensityChange,
  onLightColorChange,
  onShowLightBeamChange,
  onSpotInnerConeDegChange,
  onSpotOuterConeDegChange,
  onSpotRangeChange,
  onSpotFalloffChange
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const formatNumber = (value: number | null, digits = 2) => value === null ? '-' : value.toFixed(digits);
  const diagnosticRows = [
    [lang === 'ru' ? 'Слот' : 'Slot', diagnostics.shadowSlot === null ? '-' : `S${diagnostics.shadowSlot}`],
    [lang === 'ru' ? 'Кидает тень' : 'Casts shadow', diagnostics.castsShadow ? (lang === 'ru' ? 'да' : 'yes') : (lang === 'ru' ? 'нет' : 'no')],
    [lang === 'ru' ? 'Проекция' : 'Projection', diagnostics.shadowProjection],
    [lang === 'ru' ? 'Shadow far' : 'Shadow far', formatNumber(diagnostics.shadowFar, 1)],
    [lang === 'ru' ? 'Эфф. bias' : 'Effective bias', diagnostics.effectiveBias.toExponential(2)],
    [lang === 'ru' ? 'Конус' : 'Cone', diagnostics.cone ? `${diagnostics.cone[0].toFixed(0)}° / ${diagnostics.cone[1].toFixed(0)}°` : '-'],
    [lang === 'ru' ? 'Дальность' : 'Range', formatNumber(diagnostics.range, 1)],
    [lang === 'ru' ? 'Затухание' : 'Falloff', formatNumber(diagnostics.falloff, 2)],
    [lang === 'ru' ? 'Ortho size' : 'Ortho size', formatNumber(diagnostics.shadowOrthoSize, 1)]
  ];

  return (
    <PanelSection title={lang === 'ru' ? 'Параметры света' : 'Light params'} collapsible={false}>
      <RangeControl
        label={`${strings.lightIntensity}: ${lightIntensity.toFixed(2)}`}
        help={lang === 'ru' ? 'Сила выбранного источника света.' : 'Intensity of the selected light.'}
        min="0.0"
        max="3.0"
        step="0.1"
        value={lightIntensity}
        onChange={onLightIntensityChange}
        marginBottom={6}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
        <input
          type="color"
          value={lightColor}
          onChange={(event) => onLightColorChange(event.target.value)}
          style={colorInputStyle}
        />
        {lang === 'ru' ? 'Цвет света' : 'Light color'}
        <HelpMark text={lang === 'ru' ? 'Цветовой оттенок активного источника.' : 'Color tint of the active light.'} />
      </label>

      <div style={{ fontSize: 13, marginBottom: 5, opacity: 0.85 }}>{`${strings.lightModeLabel}: ${lightMode.toUpperCase()}`}</div>
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

      <div
        style={{
          marginTop: 8,
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid #2a303c',
          background: '#1d222b',
          fontSize: 12,
          color: '#dbe4ff'
        }}
      >
        {shadowSlot === null
          ? lang === 'ru'
            ? 'Shadow slot: не назначен'
            : 'Shadow slot: not assigned'
          : lang === 'ru'
            ? `Shadow slot: ${shadowSlot}`
            : `Shadow slot: ${shadowSlot}`}
      </div>

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a303c' }}>
        <button
          type="button"
          onClick={() => setDetailsOpen((previous) => !previous)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 0,
            background: 'transparent',
            color: '#e6e6e6',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {lang === 'ru' ? 'Детали типа света' : 'Light type details'}
          </span>
          <span>{detailsOpen ? '▴' : '▾'}</span>
        </button>

        {detailsOpen ? (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: lightMode === 'spot' ? 8 : 0 }}>
              <input
                type="checkbox"
                checked={showLightBeam}
                onChange={(event) => onShowLightBeamChange(event.target.checked)}
              />
              {strings.lightBeamShow}
              <HelpMark text={lang === 'ru' ? 'Показывает направление выбранного источника, когда он в фокусе.' : 'Shows selected light direction while it is focused.'} />
            </label>

            {lightMode === 'spot' ? (
              <>
                <RangeControl
                  label={lang === 'ru' ? `Внутренний конус: ${spotInnerConeDeg.toFixed(0)}°` : `Inner cone: ${spotInnerConeDeg.toFixed(0)}°`}
                  help={lang === 'ru' ? 'Зона прожектора с полной яркостью.' : 'Full-brightness area of the spotlight.'}
                  min={1}
                  max={80}
                  step={1}
                  value={spotInnerConeDeg}
                  onChange={onSpotInnerConeDegChange}
                  marginBottom={6}
                />

                <RangeControl
                  label={lang === 'ru' ? `Внешний конус: ${spotOuterConeDeg.toFixed(0)}°` : `Outer cone: ${spotOuterConeDeg.toFixed(0)}°`}
                  help={lang === 'ru' ? 'Граница, за которой свет прожектора исчезает.' : 'Boundary where spotlight contribution fades out.'}
                  min={2}
                  max={90}
                  step={1}
                  value={spotOuterConeDeg}
                  onChange={onSpotOuterConeDegChange}
                  marginBottom={6}
                />

                <RangeControl
                  label={lang === 'ru' ? `Дальность: ${spotRange.toFixed(1)}` : `Range: ${spotRange.toFixed(1)}`}
                  help={lang === 'ru' ? 'Максимальная дистанция влияния прожектора.' : 'Maximum distance affected by the spotlight.'}
                  min={2}
                  max={30}
                  step={0.5}
                  value={spotRange}
                  onChange={onSpotRangeChange}
                  marginBottom={6}
                />

                <RangeControl
                  label={lang === 'ru' ? `Затухание: ${spotFalloff.toFixed(2)}` : `Falloff: ${spotFalloff.toFixed(2)}`}
                  help={lang === 'ru' ? 'Как быстро свет ослабевает к краю и по дистанции.' : 'How quickly light fades toward the edge and over distance.'}
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={spotFalloff}
                  onChange={onSpotFalloffChange}
                  marginBottom={0}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a303c' }}>
        <button
          type="button"
          onClick={() => setDiagnosticsOpen((previous) => !previous)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 0,
            background: 'transparent',
            color: '#e6e6e6',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <span>{lang === 'ru' ? 'Диагностика теней' : 'Shadow diagnostics'}</span>
          <span>{diagnosticsOpen ? '▴' : '▾'}</span>
        </button>

        {diagnosticsOpen ? (
          <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
            {diagnosticRows.map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 8,
                  fontSize: 12,
                  color: '#cfd6e4'
                }}
              >
                <span style={{ opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: '#e6e6e6' }}>{value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </PanelSection>
  );
}
