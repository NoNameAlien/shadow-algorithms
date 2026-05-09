import {
  createShadowResources as createShadowResourceSet,
  createVSMResources as createVSMResourceSet,
} from "./resources";
import type { ShadowSlot } from "./shadowSlots";

export type ShadowPassDrawCallback = (pass: GPURenderPassEncoder, slotIndex: number) => void;

export class ShadowRenderer {
  shadowTex!: GPUTexture;
  shadowView!: GPUTextureView;
  shadowLayerViews: GPUTextureView[] = [];
  shadowSampler!: GPUSampler;
  shadowDebugSampler!: GPUSampler;
  shadowDebugTextures: GPUTexture[] = [];
  shadowDebugViews: GPUTextureView[] = [];

  vsmMomentsTex!: GPUTexture;
  vsmMomentsView!: GPUTextureView;
  vsmMomentsLayerViews: GPUTextureView[] = [];
  vsmBlurTex!: GPUTexture;
  vsmBlurView!: GPUTextureView;
  vsmBlurLayerViews: GPUTextureView[] = [];
  vsmSampler!: GPUSampler;

  createShadowResources(device: GPUDevice, shadowSize: number, layerCount: number): void {
    const resources = createShadowResourceSet(device, shadowSize, layerCount, {
      shadowTex: this.shadowTex,
    });

    this.shadowTex = resources.shadowTex;
    this.shadowView = resources.shadowView;
    this.shadowLayerViews = resources.shadowLayerViews;
    this.shadowSampler = resources.shadowSampler;
    this.shadowDebugSampler = resources.shadowSamplerLinear;

    for (const texture of this.shadowDebugTextures) {
      texture.destroy();
    }

    this.shadowDebugTextures = Array.from({ length: layerCount }, (_, slotIndex) =>
      device.createTexture({
        label: `shadow debug color texture slot ${slotIndex}`,
        size: [shadowSize, shadowSize],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      }),
    );
    this.shadowDebugViews = this.shadowDebugTextures.map((texture) => texture.createView());
  }

  createVSMResources(device: GPUDevice, shadowSize: number, layerCount: number): void {
    const resources = createVSMResourceSet(device, shadowSize, layerCount, {
      vsmMomentsTex: this.vsmMomentsTex,
      vsmBlurTex: this.vsmBlurTex,
    });

    this.vsmMomentsTex = resources.vsmMomentsTex;
    this.vsmMomentsView = resources.vsmMomentsView;
    this.vsmMomentsLayerViews = resources.vsmMomentsLayerViews;
    this.vsmBlurTex = resources.vsmBlurTex;
    this.vsmBlurView = resources.vsmBlurView;
    this.vsmBlurLayerViews = resources.vsmBlurLayerViews;
    this.vsmSampler = resources.vsmSampler;
  }

  createVsmBlurBindGroup(device: GPUDevice, pipeline: GPUComputePipeline): GPUBindGroup {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.vsmMomentsView },
        { binding: 1, resource: this.vsmBlurView },
      ],
    });
  }

  createDebugShadowBindGroups(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
  ): GPUBindGroup[] {
    return this.shadowDebugViews.map((view, slotIndex) =>
      device.createBindGroup({
        label: `shadow debug overlay bind group slot ${slotIndex}`,
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: view },
          { binding: 1, resource: this.shadowDebugSampler },
        ],
      }),
    );
  }

  createDebugVsmBindGroups(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    layerCount: number,
  ): GPUBindGroup[] {
    return Array.from({ length: layerCount }, (_, slotIndex) =>
      device.createBindGroup({
        label: `vsm debug overlay bind group slot ${slotIndex}`,
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.vsmBlurLayerViews[slotIndex] ?? this.vsmBlurView },
          { binding: 1, resource: this.vsmSampler },
        ],
      }),
    );
  }

  renderDepthSlots(params: {
    encoder: GPUCommandEncoder;
    slots: ShadowSlot[];
    shadowPipeline: GPURenderPipeline;
    debugShadowDepthPipeline: GPURenderPipeline;
    debugShadowSlotIndex: number | null;
    drawShadowCasters: ShadowPassDrawCallback;
    drawDebugShadowCasters: ShadowPassDrawCallback;
  }): void {
    const debugShadowDepth = params.debugShadowSlotIndex !== null;
    this.clearInactiveDepthDebugSlot(params.encoder, params.slots, params.debugShadowSlotIndex);

    for (const slot of params.slots) {
      const shadowPass = params.encoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: slot.depthView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      shadowPass.setPipeline(params.shadowPipeline);
      params.drawShadowCasters(shadowPass, slot.slotIndex);
      shadowPass.end();

      if (debugShadowDepth && slot.slotIndex === params.debugShadowSlotIndex) {
        this.renderShadowDebugDepthPass(
          params.encoder,
          slot.debugView,
          slot.slotIndex,
          params.debugShadowDepthPipeline,
          params.drawDebugShadowCasters,
        );
      }
    }
  }

  renderVsmSlots(params: {
    encoder: GPUCommandEncoder;
    slots: ShadowSlot[];
    vsmMomentsPipeline: GPURenderPipeline;
    blurHorizontalPipeline: GPUComputePipeline;
    vsmBlurBindGroup: GPUBindGroup;
    shadowSize: number;
    layerCount: number;
    debugShadowSlotIndex: number | null;
    drawVsmCasters: ShadowPassDrawCallback;
  }): void {
    for (const slot of params.slots) {
      const momentsView = this.vsmMomentsLayerViews[slot.slotIndex];
      if (!momentsView) continue;

      const vsmPass = params.encoder.beginRenderPass({
        colorAttachments: [
          {
            view: momentsView,
            clearValue: { r: 1.0, g: 1.0, b: 0.0, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: slot.depthView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      vsmPass.setPipeline(params.vsmMomentsPipeline);
      params.drawVsmCasters(vsmPass, slot.slotIndex);
      vsmPass.end();
    }

    this.clearInactiveVsmDebugSlot(params.encoder, params.slots, params.debugShadowSlotIndex);

    const blurH = params.encoder.beginComputePass();
    blurH.setPipeline(params.blurHorizontalPipeline);
    blurH.setBindGroup(0, params.vsmBlurBindGroup);
    const workgroupsX = Math.ceil(params.shadowSize / 8);
    const workgroupsY = Math.ceil(params.shadowSize / 8);
    blurH.dispatchWorkgroups(workgroupsX, workgroupsY, params.layerCount);
    blurH.end();
  }

  private clearInactiveDepthDebugSlot(
    encoder: GPUCommandEncoder,
    slots: ShadowSlot[],
    debugShadowSlotIndex: number | null,
  ): void {
    if (
      debugShadowSlotIndex === null ||
      slots.some((slot) => slot.slotIndex === debugShadowSlotIndex)
    ) {
      return;
    }

    const debugView = this.shadowDebugViews[debugShadowSlotIndex];
    if (!debugView) return;

    const clearDebugPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: debugView,
          clearValue: { r: 1.0, g: 1.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    clearDebugPass.end();
  }

  private clearInactiveVsmDebugSlot(
    encoder: GPUCommandEncoder,
    slots: ShadowSlot[],
    debugShadowSlotIndex: number | null,
  ): void {
    if (
      debugShadowSlotIndex === null ||
      slots.some((slot) => slot.slotIndex === debugShadowSlotIndex)
    ) {
      return;
    }

    const emptyMomentsView = this.vsmMomentsLayerViews[debugShadowSlotIndex];
    if (!emptyMomentsView) return;

    const clearVsmDebugPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: emptyMomentsView,
          clearValue: { r: 1.0, g: 1.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    clearVsmDebugPass.end();
  }

  private renderShadowDebugDepthPass(
    encoder: GPUCommandEncoder,
    targetView: GPUTextureView,
    shadowBufferIndex: number,
    debugShadowDepthPipeline: GPURenderPipeline,
    drawDebugShadowCasters: ShadowPassDrawCallback,
  ): void {
    const debugPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          clearValue: { r: 1.0, g: 1.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    debugPass.setPipeline(debugShadowDepthPipeline);
    drawDebugShadowCasters(debugPass, shadowBufferIndex);
    debugPass.end();
  }

  destroy(): void {
    this.shadowTex?.destroy();
    for (const texture of this.shadowDebugTextures) {
      texture.destroy();
    }
    this.vsmMomentsTex?.destroy();
    this.vsmBlurTex?.destroy();

    this.shadowDebugTextures = [];
    this.shadowDebugViews = [];
    this.shadowLayerViews = [];
    this.vsmMomentsLayerViews = [];
    this.vsmBlurLayerViews = [];
  }
}
