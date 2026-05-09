import type {
  LightDebugMode,
  LightDTO,
  LightMode,
  ObjectDTO,
  SceneDTO,
  ShadowDebugMode,
  ShadowMethod,
  ShadowParamsDTO
} from '../engine/types';

const SHADOW_METHODS: readonly ShadowMethod[] = ['SM', 'PCF', 'PCSS', 'VSM'];
const LIGHT_MODES: readonly LightMode[] = ['sun', 'spot', 'top'];
const LIGHT_DEBUG_MODES: readonly LightDebugMode[] = [
  'final',
  'lighting',
  'diffuse',
  'specular',
  'shadow',
  'normals',
  'activeCone',
  'activeFalloff',
  'activeShadow'
];

const DEFAULT_SHADOW_PARAMS: ShadowParamsDTO = {
  shadowMapSize: 2048,
  bias: 0.003,
  method: 'SM',
  pcfRadius: 2.5,
  pcfSamples: 8,
  pcssLightSize: 0.08,
  pcssBlockerSearchSamples: 8,
  vsmMinVariance: 0.0001,
  vsmLightBleedReduction: 0.4,
  shadowStrength: 1.0,
  ambientStrength: 0.4,
  exposure: 0.9,
  hemisphereSkyColor: [0.62, 0.68, 0.78],
  hemisphereGroundColor: [0.18, 0.16, 0.14],
  lightDebugMode: 'final',
  debugShadowMap: 'off'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const boolValue = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const stringValue = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : fallback;

const enumValue = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;

const numberTuple = (
  value: unknown,
  fallback: [number, number, number],
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY
): [number, number, number] => {
  if (!Array.isArray(value)) return fallback;

  return [
    clamp(finiteNumber(value[0], fallback[0]), min, max),
    clamp(finiteNumber(value[1], fallback[1]), min, max),
    clamp(finiteNumber(value[2], fallback[2]), min, max)
  ];
};

const shadowDebugMode = (value: unknown): ShadowDebugMode => {
  if (value === 'primary' || value === 'secondary' || value === 'off') return value;
  if (typeof value === 'string' && /^slot[0-7]$/.test(value)) return value as ShadowDebugMode;
  return DEFAULT_SHADOW_PARAMS.debugShadowMap;
};

const shadowMapSize = (value: unknown) => {
  const raw = clamp(finiteNumber(value, DEFAULT_SHADOW_PARAMS.shadowMapSize), 512, 4096);
  return Math.round(raw / 512) * 512;
};

const sanitizeShadowParams = (value: unknown): ShadowParamsDTO => {
  const params = isRecord(value) ? value : {};

  return {
    shadowMapSize: shadowMapSize(params.shadowMapSize),
    bias: clamp(finiteNumber(params.bias, DEFAULT_SHADOW_PARAMS.bias), 0.0001, 0.05),
    method: enumValue(params.method, SHADOW_METHODS, DEFAULT_SHADOW_PARAMS.method),
    pcfRadius: clamp(finiteNumber(params.pcfRadius, DEFAULT_SHADOW_PARAMS.pcfRadius), 0.1, 10),
    pcfSamples: clamp(Math.round(finiteNumber(params.pcfSamples, DEFAULT_SHADOW_PARAMS.pcfSamples)), 1, 64),
    pcssLightSize: clamp(finiteNumber(params.pcssLightSize, DEFAULT_SHADOW_PARAMS.pcssLightSize), 0.001, 1),
    pcssBlockerSearchSamples: clamp(
      Math.round(finiteNumber(params.pcssBlockerSearchSamples, DEFAULT_SHADOW_PARAMS.pcssBlockerSearchSamples)),
      1,
      64
    ),
    vsmMinVariance: clamp(finiteNumber(params.vsmMinVariance, DEFAULT_SHADOW_PARAMS.vsmMinVariance), 0.000001, 0.01),
    vsmLightBleedReduction: clamp(
      finiteNumber(params.vsmLightBleedReduction, DEFAULT_SHADOW_PARAMS.vsmLightBleedReduction),
      0,
      0.95
    ),
    shadowStrength: clamp(finiteNumber(params.shadowStrength, DEFAULT_SHADOW_PARAMS.shadowStrength), 0, 2),
    ambientStrength: clamp(finiteNumber(params.ambientStrength, DEFAULT_SHADOW_PARAMS.ambientStrength), 0, 1),
    exposure: clamp(finiteNumber(params.exposure, DEFAULT_SHADOW_PARAMS.exposure), 0.1, 4),
    hemisphereSkyColor: numberTuple(params.hemisphereSkyColor, DEFAULT_SHADOW_PARAMS.hemisphereSkyColor ?? [0.62, 0.68, 0.78], 0, 1),
    hemisphereGroundColor: numberTuple(params.hemisphereGroundColor, DEFAULT_SHADOW_PARAMS.hemisphereGroundColor ?? [0.18, 0.16, 0.14], 0, 1),
    lightDebugMode: enumValue(params.lightDebugMode, LIGHT_DEBUG_MODES, DEFAULT_SHADOW_PARAMS.lightDebugMode),
    debugShadowMap: shadowDebugMode(params.debugShadowMap)
  };
};

const sanitizeLight = (value: unknown, index: number): LightDTO | null => {
  if (!isRecord(value)) return null;
  const type = enumValue(value.type, LIGHT_MODES, index === 0 ? 'sun' : 'spot');

  return {
    name: stringValue(value.name, `Light ${index + 1}`),
    pos: numberTuple(value.pos, index === 0 ? [5, 10, 3] : [-6, 8, -4], -1000, 1000),
    type,
    yaw: clamp(finiteNumber(value.yaw, 0.8), -Math.PI * 2, Math.PI * 2),
    pitch: clamp(finiteNumber(value.pitch, -0.6), -Math.PI * 0.5, Math.PI * 0.5),
    intensity: clamp(finiteNumber(value.intensity, 1), 0, 10),
    color: numberTuple(value.color, [1, 1, 1], 0, 1),
    castShadows: boolValue(value.castShadows, index === 0),
    innerConeDeg: clamp(finiteNumber(value.innerConeDeg, 15), 0, 89),
    outerConeDeg: clamp(finiteNumber(value.outerConeDeg, 28), 1, 120),
    range: clamp(finiteNumber(value.range, 12), 0.1, 200),
    falloff: clamp(finiteNumber(value.falloff, 1.5), 0.1, 8)
  };
};

const sanitizeObject = (value: unknown, index: number): ObjectDTO | null => {
  if (!isRecord(value)) return null;

  return {
    name: stringValue(value.name, `Object ${index + 1}`),
    pos: numberTuple(value.pos, [0, 0, 0], -1000, 1000),
    scale: numberTuple(value.scale, [1, 1, 1], 0.01, 100),
    moveSpeed: clamp(finiteNumber(value.moveSpeed, 1), 0.01, 20),
    color: numberTuple(value.color, [1, 1, 1], 0, 1),
    castShadows: boolValue(value.castShadows, true),
    receiveShadows: boolValue(value.receiveShadows, false),
    selfShadows: boolValue(value.selfShadows, false),
    meshId: Math.max(0, Math.round(finiteNumber(value.meshId, 0))),
    specular: clamp(finiteNumber(value.specular, 0.5), 0, 2),
    shininess: clamp(finiteNumber(value.shininess, 32), 1, 256),
    roughness: clamp(finiteNumber(value.roughness, 0.45), 0.02, 1)
  };
};

export function validateSceneDTO(value: unknown): SceneDTO {
  if (!isRecord(value)) {
    throw new Error('Scene JSON must be an object');
  }

  const lights = Array.isArray(value.lights)
    ? value.lights.map(sanitizeLight).filter((light): light is LightDTO => light !== null)
    : [];
  const objects = Array.isArray(value.objects)
    ? value.objects.map(sanitizeObject).filter((object): object is ObjectDTO => object !== null)
    : [];

  return {
    lights,
    objects,
    floorColor: numberTuple(value.floorColor, [0.15, 0.16, 0.18], 0, 1),
    wallColor: numberTuple(value.wallColor, [0.1, 0.11, 0.13], 0, 1),
    showFloor: boolValue(value.showFloor, true),
    showWalls: boolValue(value.showWalls, true),
    floorSize: clamp(finiteNumber(value.floorSize, 10), 1, 100),
    showGrid: boolValue(value.showGrid, true),
    shadowParams: sanitizeShadowParams(value.shadowParams)
  };
}
