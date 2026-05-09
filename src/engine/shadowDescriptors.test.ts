import { vec3 } from "gl-matrix";
import { describe, expect, it } from "vitest";
import type { LightDef } from "./types";
import {
  getClampedOuterConeRad,
  getShadowProjectionDescriptor,
  getShadowTargetForLight,
  getSpotShadowFar,
} from "./shadowDescriptors";

const createSpot = (overrides: Partial<LightDef> = {}): LightDef => ({
  name: "Spot",
  pos: vec3.fromValues(2, 4, 3),
  type: "spot",
  yaw: 0.25,
  pitch: -0.45,
  intensity: 2,
  color: vec3.fromValues(1, 0.9, 0.8),
  castShadows: true,
  innerConeDeg: 16,
  outerConeDeg: 32,
  range: 12,
  falloff: 1.5,
  ...overrides,
});

describe("shadow projection descriptors", () => {
  it("uses perspective projection for spot shadows", () => {
    const descriptor = getShadowProjectionDescriptor(createSpot());

    expect(descriptor.type).toBe("perspective");
    if (descriptor.type === "perspective") {
      expect(descriptor.far).toBeCloseTo(getSpotShadowFar(12));
      expect(descriptor.fovY).toBeGreaterThan(0);
    }
  });

  it("keeps non-spot lights on a stable orthographic projection", () => {
    const descriptor = getShadowProjectionDescriptor(undefined);

    expect(descriptor.type).toBe("orthographic");
    if (descriptor.type === "orthographic") {
      expect(descriptor.size).toBe(8);
    }
  });

  it("clamps spot cone and computes the target from yaw and pitch", () => {
    expect(getClampedOuterConeRad(120)).toBeCloseTo((78 * Math.PI) / 180);

    const target = getShadowTargetForLight(
      createSpot({ yaw: 0, pitch: 0, range: 20 }),
      vec3.create(),
      vec3.create(),
    );

    expect(target[0]).toBeCloseTo(2);
    expect(target[1]).toBeCloseTo(4);
    expect(target[2]).toBeGreaterThan(3);
  });
});
