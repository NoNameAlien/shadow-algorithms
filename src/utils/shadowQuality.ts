import type { ShadowParams } from '../components/control-panel/types';

export type ShadowQualityId = 'raw' | 'low' | 'medium' | 'high';

export type ShadowQualityPreset = {
  id: ShadowQualityId;
  label: {
    en: string;
    ru: string;
  };
  params: Partial<ShadowParams>;
};

export const SHADOW_QUALITY_PRESETS: ShadowQualityPreset[] = [
  {
    id: 'raw',
    label: { en: 'Raw', ru: 'Raw' },
    params: {
      method: 'SM',
      shadowMapSize: 512,
      bias: 0.006,
      pcfRadius: 0.5,
      pcfSamples: 4,
      pcssLightSize: 0.02,
      pcssBlockerSearchSamples: 8,
      vsmLightBleedReduction: 0.55,
      shadowStrength: 1.15
    }
  },
  {
    id: 'low',
    label: { en: 'Low', ru: 'Низк.' },
    params: {
      shadowMapSize: 1024,
      bias: 0.006,
      pcfRadius: 1.25,
      pcfSamples: 4,
      pcssLightSize: 0.04,
      pcssBlockerSearchSamples: 8,
      vsmLightBleedReduction: 0.5
    }
  },
  {
    id: 'medium',
    label: { en: 'Medium', ru: 'Сред.' },
    params: {
      shadowMapSize: 2048,
      bias: 0.003,
      pcfRadius: 2.5,
      pcfSamples: 8,
      pcssLightSize: 0.08,
      pcssBlockerSearchSamples: 8,
      vsmLightBleedReduction: 0.4
    }
  },
  {
    id: 'high',
    label: { en: 'High', ru: 'Выс.' },
    params: {
      shadowMapSize: 4096,
      bias: 0.0015,
      pcfRadius: 4,
      pcfSamples: 32,
      pcssLightSize: 0.14,
      pcssBlockerSearchSamples: 32,
      vsmLightBleedReduction: 0.3
    }
  }
];

export function getShadowQualityPreset(params: ShadowParams): ShadowQualityPreset | null {
  return SHADOW_QUALITY_PRESETS.find((preset) =>
    Object.entries(preset.params).every(([key, value]) => {
      const actual = params[key as keyof ShadowParams];
      if (typeof value === 'number' && typeof actual === 'number') {
        return Math.abs(actual - value) < 0.000001;
      }
      return actual === value;
    })
  ) ?? null;
}

export function getShadowQualityLabel(params: ShadowParams, lang: 'en' | 'ru' = 'en'): string {
  return getShadowQualityPreset(params)?.label[lang] ?? (lang === 'ru' ? 'Польз.' : 'Custom');
}

export function getShadowMethodNotes(params: ShadowParams): string {
  if (params.method === 'SM') {
    return `hard shadows, map ${params.shadowMapSize}`;
  }
  if (params.method === 'PCF') {
    return `radius ${params.pcfRadius ?? '-'}, samples ${params.pcfSamples ?? '-'}`;
  }
  if (params.method === 'PCSS') {
    return `light size ${params.pcssLightSize ?? '-'}, blockers ${params.pcssBlockerSearchSamples ?? '-'}`;
  }
  return `variance ${params.vsmMinVariance?.toExponential(1) ?? '-'}, bleed ${params.vsmLightBleedReduction ?? '-'}`;
}
