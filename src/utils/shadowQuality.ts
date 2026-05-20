import type { ShadowParams } from '../components/control-panel/types';
import type { ShadowMethod } from '../engine/types';

export type ShadowQualityId = 'raw' | 'low' | 'medium' | 'high';

export type ShadowQualityPreset = {
  id: ShadowQualityId;
  label: {
    en: string;
    ru: string;
  };
  params: Partial<ShadowParams>;
  methods?: ShadowMethod[];
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
    },
    methods: ['SM']
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
      vsmLightBleedReduction: 0.25
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
      vsmLightBleedReduction: 0.2
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
      vsmLightBleedReduction: 0.18
    }
  }
];

export function getAvailableShadowQualityPresets(method: ShadowMethod): ShadowQualityPreset[] {
  return SHADOW_QUALITY_PRESETS.filter((preset) => !preset.methods || preset.methods.includes(method));
}

export function getShadowQualityPreset(params: ShadowParams): ShadowQualityPreset | null {
  const availablePresets = getAvailableShadowQualityPresets(params.method);

  if (params.method === 'SM' && params.shadowMapSize === 512) {
    return availablePresets.find((preset) => preset.id === 'raw') ?? null;
  }

  return availablePresets.find((preset) =>
    preset.id !== 'raw' &&
    preset.params.shadowMapSize === params.shadowMapSize
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
