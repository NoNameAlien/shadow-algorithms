import type { vec3 } from "gl-matrix";
import type { LightDef } from "./types";

export type ShadowProjectionDescriptor =
  | {
      type: "perspective";
      near: number;
      far: number;
      fovY: number;
      aspect: number;
      shadowOrthoSize: null;
    }
  | {
      type: "orthographic";
      near: number;
      far: number;
      size: number;
      shadowOrthoSize: number | null;
    };

export function getShadowProjectionDescriptor(light: LightDef | undefined): ShadowProjectionDescriptor {
  if (light?.type === "spot") {
    const range = Math.max(4, light.range);
    const outerConeRad = getClampedOuterConeRad(light.outerConeDeg);
    const far = getSpotShadowFar(range);
    const near = 0.05;

    return {
      type: "perspective",
      near,
      far,
      fovY: getSpotShadowFovY(outerConeRad),
      aspect: 1,
      shadowOrthoSize: null,
    };
  }

  return {
    type: "orthographic",
    near: 1.0,
    far: 20.0,
    size: 8,
    shadowOrthoSize: null,
  };
}

export function getShadowTargetForLight(
  light: LightDef | undefined,
  out: vec3,
  tempDir: vec3,
): vec3 {
  if (!light || light.type !== "spot") {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
  }

  tempDir[0] = Math.cos(light.pitch) * Math.sin(light.yaw);
  tempDir[1] = Math.sin(light.pitch);
  tempDir[2] = Math.cos(light.pitch) * Math.cos(light.yaw);
  normalizeVec3(tempDir);

  const distance = Math.max(10.0, light.range * 0.75);
  out[0] = light.pos[0] + tempDir[0] * distance;
  out[1] = light.pos[1] + tempDir[1] * distance;
  out[2] = light.pos[2] + tempDir[2] * distance;
  return out;
}

export function getStableShadowUp(lightPos: vec3, out: vec3, tempDir: vec3): vec3 {
  tempDir[0] = lightPos[0];
  tempDir[1] = lightPos[1];
  tempDir[2] = lightPos[2];
  normalizeVec3(tempDir);

  out[0] = 0;
  out[1] = 1;
  out[2] = 0;

  if (Math.abs(tempDir[1]) > 0.99) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 1;
  }

  return out;
}

export function getSpotShadowFar(range: number): number {
  return Math.max(8, range * 1.45);
}

export function getClampedOuterConeRad(outerConeDeg: number): number {
  return (Math.max(1, Math.min(78, outerConeDeg)) * Math.PI) / 180;
}

function getSpotShadowFovY(outerConeRad: number): number {
  return Math.max((2 * Math.PI) / 180, Math.min((156 * Math.PI) / 180, outerConeRad * 2.1));
}

function normalizeVec3(v: vec3): vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len > 0.000001) {
    v[0] /= len;
    v[1] /= len;
    v[2] /= len;
  }
  return v;
}
