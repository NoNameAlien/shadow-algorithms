import { describe, expect, it } from "vitest";
import type { LightDef } from "./types";
import {
  LIGHTS_DATA_FLOATS,
  LIGHTS_HEADER_FLOATS,
  LIGHT_OFFSETS,
  LIGHT_STRUCT_FLOATS,
  SHADING_FLOATS,
  SHADING_OFFSETS,
  SHADOW_MATS_FLOATS,
  getLightBufferOffset,
  lightTypeIndex,
  writeLightToBuffer,
  writeShadingParamsToBuffer,
} from "./uniformLayouts";

describe("uniform layout constants", () => {
  it("matches WGSL uniform buffer float counts", () => {
    expect(SHADING_FLOATS).toBe(24);
    expect(LIGHTS_HEADER_FLOATS).toBe(8);
    expect(LIGHT_STRUCT_FLOATS).toBe(16);
    expect(LIGHTS_DATA_FLOATS).toBe(136);
    expect(SHADOW_MATS_FLOATS).toBe(136);
  });

  it("computes light struct offsets after the padded header", () => {
    expect(getLightBufferOffset(0)).toBe(8);
    expect(getLightBufferOffset(3)).toBe(56);
  });
});

describe("writeShadingParamsToBuffer", () => {
  it("packs scalar params and ambient colors into named offsets", () => {
    const target = new Float32Array(SHADING_FLOATS);
    target.fill(99);

    writeShadingParamsToBuffer(target, {
      shadowStrength: 0.8,
      lightModeIndex: 1,
      spotYaw: 0.2,
      spotPitch: -0.3,
      methodIndex: 2,
      lightIntensity: 4,
      shadowCaster0: 0,
      shadowCaster1: 3,
      ambientStrength: 0.35,
      exposure: 1.1,
      lightDebugMode: 8,
      activeLightIndex: 2,
      skyAmbient: [0.1, 0.2, 0.3],
      groundAmbient: [0.4, 0.5, 0.6],
    });

    expect(target[SHADING_OFFSETS.shadowStrength]).toBeCloseTo(0.8);
    expect(target[SHADING_OFFSETS.methodIndex]).toBe(2);
    expect(target[SHADING_OFFSETS.lightDebugMode]).toBe(8);
    expect(target[SHADING_OFFSETS.activeLightIndex]).toBe(2);
    expect(target[SHADING_OFFSETS.skyAmbientR]).toBeCloseTo(0.1);
    expect(target[SHADING_OFFSETS.skyAmbientG]).toBeCloseTo(0.2);
    expect(target[SHADING_OFFSETS.skyAmbientB]).toBeCloseTo(0.3);
    expect(target[SHADING_OFFSETS.groundAmbientR]).toBeCloseTo(0.4);
    expect(target[SHADING_OFFSETS.groundAmbientG]).toBeCloseTo(0.5);
    expect(target[SHADING_OFFSETS.groundAmbientB]).toBeCloseTo(0.6);
    expect(target[SHADING_OFFSETS.skyAmbientPad]).toBe(0);
    expect(target[SHADING_OFFSETS.groundAmbientPad]).toBe(0);
    expect(target[23]).toBe(0);
  });
});

describe("writeLightToBuffer", () => {
  it("packs a concrete light into a LightsData entry", () => {
    const target = new Float32Array(LIGHTS_DATA_FLOATS);
    const light = {
      name: "Key",
      pos: [1, 2, 3],
      type: "spot",
      yaw: 0.4,
      pitch: -0.5,
      intensity: 2.5,
      color: [0.7, 0.8, 0.9],
      castShadows: true,
      innerConeDeg: 12,
      outerConeDeg: 24,
      range: 16,
      falloff: 2,
    } as LightDef;

    writeLightToBuffer(target, 1, light, 1, {
      pos: [9, 9, 9],
      type: "sun",
      yaw: 9,
      pitch: 9,
      intensity: 9,
    });

    const base = getLightBufferOffset(1);
    expect(target[base + LIGHT_OFFSETS.posX]).toBe(1);
    expect(target[base + LIGHT_OFFSETS.posY]).toBe(2);
    expect(target[base + LIGHT_OFFSETS.posZ]).toBe(3);
    expect(target[base + LIGHT_OFFSETS.type]).toBe(lightTypeIndex("spot"));
    expect(target[base + LIGHT_OFFSETS.yaw]).toBeCloseTo(0.4);
    expect(target[base + LIGHT_OFFSETS.pitch]).toBeCloseTo(-0.5);
    expect(target[base + LIGHT_OFFSETS.intensity]).toBeCloseTo(2.5);
    expect(target[base + LIGHT_OFFSETS.shadowIndex]).toBe(1);
    expect(target[base + LIGHT_OFFSETS.colorR]).toBeCloseTo(0.7);
    expect(target[base + LIGHT_OFFSETS.colorG]).toBeCloseTo(0.8);
    expect(target[base + LIGHT_OFFSETS.colorB]).toBeCloseTo(0.9);
    expect(target[base + LIGHT_OFFSETS.innerConeDeg]).toBe(12);
    expect(target[base + LIGHT_OFFSETS.outerConeDeg]).toBe(24);
    expect(target[base + LIGHT_OFFSETS.range]).toBe(16);
    expect(target[base + LIGHT_OFFSETS.falloff]).toBe(2);
  });

  it("uses renderer fallbacks when a light is missing", () => {
    const target = new Float32Array(LIGHTS_DATA_FLOATS);

    writeLightToBuffer(target, 0, undefined, -1, {
      pos: [4, 5, 6],
      type: "top",
      yaw: 0.1,
      pitch: 0.2,
      intensity: 0.3,
    });

    const base = getLightBufferOffset(0);
    expect(target[base + LIGHT_OFFSETS.posX]).toBe(4);
    expect(target[base + LIGHT_OFFSETS.posY]).toBe(5);
    expect(target[base + LIGHT_OFFSETS.posZ]).toBe(6);
    expect(target[base + LIGHT_OFFSETS.type]).toBe(lightTypeIndex("top"));
    expect(target[base + LIGHT_OFFSETS.yaw]).toBeCloseTo(0.1);
    expect(target[base + LIGHT_OFFSETS.pitch]).toBeCloseTo(0.2);
    expect(target[base + LIGHT_OFFSETS.intensity]).toBeCloseTo(0.3);
    expect(target[base + LIGHT_OFFSETS.shadowIndex]).toBe(-1);
    expect(target[base + LIGHT_OFFSETS.colorR]).toBe(1);
    expect(target[base + LIGHT_OFFSETS.innerConeDeg]).toBe(15);
    expect(target[base + LIGHT_OFFSETS.outerConeDeg]).toBe(28);
    expect(target[base + LIGHT_OFFSETS.range]).toBe(12);
    expect(target[base + LIGHT_OFFSETS.falloff]).toBeCloseTo(1.5);
  });
});
