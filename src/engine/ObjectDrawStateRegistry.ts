import type { ShadowMethod } from "./types";

export type ObjectDrawState = {
  mainUniformBuf: GPUBuffer;
  shadowUniformBufs: GPUBuffer[];
  objectParamsBuf: GPUBuffer;
  mainBindGroup: GPUBindGroup;
  shadowBindGroups: GPUBindGroup[];
  vsmMomentsBindGroups: GPUBindGroup[];
  debugShadowDepthBindGroups: GPUBindGroup[];
};

export type ObjectDrawStatePipelines = {
  mainPipeline: GPURenderPipeline;
  shadowPipeline: GPURenderPipeline;
  vsmMomentsPipeline: GPURenderPipeline;
  debugShadowDepthPipeline: GPURenderPipeline;
};

const OBJECT_UNIFORM_BUFFER_SIZE = 16 * 4 * 3 + 4 * 4 * 3;
const OBJECT_PARAMS_BUFFER_SIZE = 32;

export class ObjectDrawStateRegistry {
  private states: ObjectDrawState[] = [];
  private method: ShadowMethod | null = null;

  ensure(params: {
    device: GPUDevice;
    objectCount: number;
    method: ShadowMethod;
    maxShadowSlots: number;
    shadowMatsBuf: GPUBuffer;
    pipelines: ObjectDrawStatePipelines;
  }): void {
    if (this.states.length === params.objectCount && this.method === params.method) return;

    this.destroy();
    this.states = Array.from({ length: params.objectCount }, () =>
      this.createState(params.device, params.maxShadowSlots, params.shadowMatsBuf, params.pipelines),
    );
    this.method = params.method;
  }

  get(index: number): ObjectDrawState {
    return this.states[index];
  }

  destroy(): void {
    for (const state of this.states) {
      state.mainUniformBuf.destroy();
      for (const buffer of state.shadowUniformBufs) {
        buffer.destroy();
      }
      state.objectParamsBuf.destroy();
    }

    this.states = [];
    this.method = null;
  }

  private createState(
    device: GPUDevice,
    maxShadowSlots: number,
    shadowMatsBuf: GPUBuffer,
    pipelines: ObjectDrawStatePipelines,
  ): ObjectDrawState {
    const mainUniformBuf = this.createObjectUniformBuffer(device);
    const shadowUniformBufs = Array.from(
      { length: maxShadowSlots },
      () => this.createObjectUniformBuffer(device),
    );
    const objectParamsBuf = this.createObjectParamsBuffer(device);

    return {
      mainUniformBuf,
      shadowUniformBufs,
      objectParamsBuf,
      mainBindGroup: device.createBindGroup({
        layout: pipelines.mainPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: mainUniformBuf } },
          { binding: 1, resource: { buffer: objectParamsBuf } },
          { binding: 2, resource: { buffer: shadowMatsBuf } },
        ],
      }),
      shadowBindGroups: shadowUniformBufs.map((buffer, index) =>
        device.createBindGroup({
          label: `object shadow pass uniforms bind group ${index}`,
          layout: pipelines.shadowPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer } }],
        }),
      ),
      vsmMomentsBindGroups: shadowUniformBufs.map((buffer, index) =>
        device.createBindGroup({
          label: `object vsm moments uniforms bind group ${index}`,
          layout: pipelines.vsmMomentsPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer } }],
        }),
      ),
      debugShadowDepthBindGroups: shadowUniformBufs.map((buffer, index) =>
        device.createBindGroup({
          label: `object debug shadow depth uniforms bind group ${index}`,
          layout: pipelines.debugShadowDepthPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer } }],
        }),
      ),
    };
  }

  private createObjectUniformBuffer(device: GPUDevice): GPUBuffer {
    return device.createBuffer({
      size: OBJECT_UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private createObjectParamsBuffer(device: GPUDevice): GPUBuffer {
    return device.createBuffer({
      size: OBJECT_PARAMS_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
}
