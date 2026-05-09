import type { LightDef, LightMode } from "./types";

export const MAX_LIGHTS = 8;
export const MAX_SHADOW_SLOTS = 8;

export const SHADING_FLOATS = 24;
export const SHADOW_MATS_HEADER_FLOATS = 8;
export const MAT4_FLOATS = 16;
export const LIGHTS_HEADER_FLOATS = 8;
export const LIGHT_STRUCT_FLOATS = 16;
export const SHADOW_MATS_FLOATS = SHADOW_MATS_HEADER_FLOATS + MAX_SHADOW_SLOTS * MAT4_FLOATS;
export const LIGHTS_DATA_FLOATS = LIGHTS_HEADER_FLOATS + MAX_LIGHTS * LIGHT_STRUCT_FLOATS;

export const SHADING_OFFSETS = {
  shadowStrength: 0,
  lightMode: 1,
  spotYaw: 2,
  spotPitch: 3,
  methodIndex: 4,
  lightIntensity: 5,
  shadowCaster0: 6,
  shadowCaster1: 7,
  ambientStrength: 8,
  exposure: 9,
  lightDebugMode: 10,
  activeLightIndex: 11,
  skyAmbientR: 12,
  skyAmbientG: 13,
  skyAmbientB: 14,
  skyAmbientPad: 15,
  groundAmbientR: 16,
  groundAmbientG: 17,
  groundAmbientB: 18,
  groundAmbientPad: 19,
} as const;

export const LIGHT_OFFSETS = {
  posX: 0,
  posY: 1,
  posZ: 2,
  type: 3,
  yaw: 4,
  pitch: 5,
  intensity: 6,
  shadowIndex: 7,
  colorR: 8,
  colorG: 9,
  colorB: 10,
  innerConeDeg: 11,
  outerConeDeg: 12,
  range: 13,
  falloff: 14,
} as const;

export function lightTypeIndex(type: LightMode): number {
  if (type === "sun") return 0;
  if (type === "spot") return 1;
  return 2;
}

export type ShadingParamsInput = {
  shadowStrength: number;
  lightModeIndex: number;
  spotYaw: number;
  spotPitch: number;
  methodIndex: number;
  lightIntensity: number;
  shadowCaster0: number;
  shadowCaster1: number;
  ambientStrength: number;
  exposure: number;
  lightDebugMode: number;
  activeLightIndex: number;
  skyAmbient: ArrayLike<number>;
  groundAmbient: ArrayLike<number>;
};

export type LightBufferFallbacks = {
  pos: ArrayLike<number>;
  type: LightMode;
  yaw: number;
  pitch: number;
  intensity: number;
};

export function writeShadingParamsToBuffer(target: Float32Array, params: ShadingParamsInput): void {
  target.fill(0);
  target[SHADING_OFFSETS.shadowStrength] = params.shadowStrength;
  target[SHADING_OFFSETS.lightMode] = params.lightModeIndex;
  target[SHADING_OFFSETS.spotYaw] = params.spotYaw;
  target[SHADING_OFFSETS.spotPitch] = params.spotPitch;
  target[SHADING_OFFSETS.methodIndex] = params.methodIndex;
  target[SHADING_OFFSETS.lightIntensity] = params.lightIntensity;
  target[SHADING_OFFSETS.shadowCaster0] = params.shadowCaster0;
  target[SHADING_OFFSETS.shadowCaster1] = params.shadowCaster1;
  target[SHADING_OFFSETS.ambientStrength] = params.ambientStrength;
  target[SHADING_OFFSETS.exposure] = params.exposure;
  target[SHADING_OFFSETS.lightDebugMode] = params.lightDebugMode;
  target[SHADING_OFFSETS.activeLightIndex] = params.activeLightIndex;
  target[SHADING_OFFSETS.skyAmbientR] = params.skyAmbient[0];
  target[SHADING_OFFSETS.skyAmbientG] = params.skyAmbient[1];
  target[SHADING_OFFSETS.skyAmbientB] = params.skyAmbient[2];
  target[SHADING_OFFSETS.groundAmbientR] = params.groundAmbient[0];
  target[SHADING_OFFSETS.groundAmbientG] = params.groundAmbient[1];
  target[SHADING_OFFSETS.groundAmbientB] = params.groundAmbient[2];
}

export function getLightBufferOffset(lightIndex: number): number {
  return LIGHTS_HEADER_FLOATS + lightIndex * LIGHT_STRUCT_FLOATS;
}

export function writeLightToBuffer(
  target: Float32Array,
  lightIndex: number,
  light: LightDef | undefined,
  shadowIndex: number,
  fallbacks: LightBufferFallbacks,
): void {
  const base = getLightBufferOffset(lightIndex);
  const pos = light?.pos ?? fallbacks.pos;
  const type = light?.type ?? fallbacks.type;

  target[base + LIGHT_OFFSETS.posX] = pos[0];
  target[base + LIGHT_OFFSETS.posY] = pos[1];
  target[base + LIGHT_OFFSETS.posZ] = pos[2];
  target[base + LIGHT_OFFSETS.type] = lightTypeIndex(type);
  target[base + LIGHT_OFFSETS.yaw] = light?.yaw ?? fallbacks.yaw;
  target[base + LIGHT_OFFSETS.pitch] = light?.pitch ?? fallbacks.pitch;
  target[base + LIGHT_OFFSETS.intensity] = light?.intensity ?? fallbacks.intensity;
  target[base + LIGHT_OFFSETS.shadowIndex] = shadowIndex;
  target[base + LIGHT_OFFSETS.colorR] = light?.color[0] ?? 1.0;
  target[base + LIGHT_OFFSETS.colorG] = light?.color[1] ?? 1.0;
  target[base + LIGHT_OFFSETS.colorB] = light?.color[2] ?? 1.0;
  target[base + LIGHT_OFFSETS.innerConeDeg] = light?.innerConeDeg ?? 15;
  target[base + LIGHT_OFFSETS.outerConeDeg] = light?.outerConeDeg ?? 28;
  target[base + LIGHT_OFFSETS.range] = light?.range ?? 12;
  target[base + LIGHT_OFFSETS.falloff] = light?.falloff ?? 1.5;
}
