import { createSolidTexture } from './textureUtils';

type GeometryBufferData = Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>;

export type DepthResource = {
  texture: GPUTexture;
  view: GPUTextureView;
};

export type ShadowResources = {
  shadowTex: GPUTexture;
  shadowView: GPUTextureView;
  shadowTex1: GPUTexture;
  shadowView1: GPUTextureView;
  shadowSampler: GPUSampler;
  shadowSamplerLinear: GPUSampler;
};

export type VSMResources = {
  vsmMomentsTex: GPUTexture;
  vsmMomentsView: GPUTextureView;
  vsmBlurTex: GPUTexture;
  vsmBlurView: GPUTextureView;
  vsmSampler: GPUSampler;
};

export type UniformBuffers = {
  uniformBuf: GPUBuffer;
  axisUniformBuf: GPUBuffer;
  shadingBuf: GPUBuffer;
  gridParamsBuf: GPUBuffer;
  objectParamsBuf: GPUBuffer;
  shadowMatsBuf: GPUBuffer;
  lightsBuf: GPUBuffer;
};

export type DefaultTextureResources = {
  objTexture: GPUTexture;
  objTextureView: GPUTextureView;
  objSampler: GPUSampler;
  floorTexture: GPUTexture;
  floorTextureView: GPUTextureView;
  floorSampler: GPUSampler;
};

export function createDepthResource(
  device: GPUDevice,
  width: number,
  height: number,
  previousTexture?: GPUTexture
): DepthResource {
  previousTexture?.destroy();

  const texture = device.createTexture({
    size: { width, height },
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });

  return {
    texture,
    view: texture.createView()
  };
}

export function createShadowResources(
  device: GPUDevice,
  shadowSize: number,
  previous?: Partial<Pick<ShadowResources, 'shadowTex' | 'shadowTex1'>>
): ShadowResources {
  previous?.shadowTex?.destroy();
  previous?.shadowTex1?.destroy();

  const shadowTex = device.createTexture({
    size: [shadowSize, shadowSize],
    format: 'depth32float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  const shadowTex1 = device.createTexture({
    size: [shadowSize, shadowSize],
    format: 'depth32float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  return {
    shadowTex,
    shadowView: shadowTex.createView(),
    shadowTex1,
    shadowView1: shadowTex1.createView(),
    shadowSampler: device.createSampler({
      compare: 'less',
      magFilter: 'linear',
      minFilter: 'linear'
    }),
    shadowSamplerLinear: device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    })
  };
}

export function createVSMResources(
  device: GPUDevice,
  shadowSize: number,
  previous?: Partial<Pick<VSMResources, 'vsmMomentsTex' | 'vsmBlurTex'>>
): VSMResources {
  previous?.vsmMomentsTex?.destroy();
  previous?.vsmBlurTex?.destroy();

  const vsmMomentsTex = device.createTexture({
    size: [shadowSize, shadowSize],
    format: 'rgba16float',
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING
  });

  const vsmBlurTex = device.createTexture({
    size: [shadowSize, shadowSize],
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
  });

  return {
    vsmMomentsTex,
    vsmMomentsView: vsmMomentsTex.createView(),
    vsmBlurTex,
    vsmBlurView: vsmBlurTex.createView(),
    vsmSampler: device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    })
  };
}

export function createBufferFromData(
  device: GPUDevice,
  data: GeometryBufferData,
  usage: GPUBufferUsageFlags
): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: usage | GPUBufferUsage.COPY_DST
  });

  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

export function createUniformBuffers(device: GPUDevice): UniformBuffers {
  const uniformSize = 16 * 4 * 3 + 4 * 4 * 3;

  return {
    uniformBuf: device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    axisUniformBuf: device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    shadingBuf: device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    gridParamsBuf: device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    objectParamsBuf: device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    shadowMatsBuf: device.createBuffer({
      size: 160,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    lightsBuf: device.createBuffer({
      size: 352,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
  };
}

export function createDefaultTextureResources(device: GPUDevice): DefaultTextureResources {
  const objectTexture = createSolidTexture(device, 200, 200, 200);
  const floorTexture = createSolidTexture(device, 120, 120, 120);

  return {
    objTexture: objectTexture.texture,
    objTextureView: objectTexture.view,
    objSampler: device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat'
    }),
    floorTexture: floorTexture.texture,
    floorTextureView: floorTexture.view,
    floorSampler: device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat'
    })
  };
}
