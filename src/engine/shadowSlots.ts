import { mat4 } from "gl-matrix";

export type ShadowSlot = {
  slotIndex: number;
  lightIndex: number;
  lightViewProj: mat4;
  depthView: GPUTextureView;
  debugView: GPUTextureView;
};

export type ShadowSlotViews = {
  depthView: GPUTextureView;
  debugView: GPUTextureView;
};

export function buildShadowSlots(params: {
  casters: number[];
  maxSlots: number;
  lightViewProjs: mat4[];
  computeLightViewProj: (lightIndex: number, out: mat4) => mat4;
  getSlotViews: (slotIndex: number) => ShadowSlotViews;
}): ShadowSlot[] {
  for (const lightViewProj of params.lightViewProjs) {
    mat4.identity(lightViewProj);
  }

  const slots: ShadowSlot[] = [];
  const count = Math.min(params.casters.length, params.maxSlots);

  for (let slotIndex = 0; slotIndex < count; slotIndex++) {
    const lightIndex = params.casters[slotIndex];
    const lightViewProj = params.lightViewProjs[slotIndex];
    params.computeLightViewProj(lightIndex, lightViewProj);
    const views = params.getSlotViews(slotIndex);

    slots.push({
      slotIndex,
      lightIndex,
      lightViewProj,
      depthView: views.depthView,
      debugView: views.debugView,
    });
  }

  return slots;
}
