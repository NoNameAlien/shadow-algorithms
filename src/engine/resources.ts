import { createSolidTexture } from './textureUtils';
import { LIGHTS_DATA_FLOATS, SHADING_FLOATS, SHADOW_MATS_FLOATS } from './uniformLayouts';

type GeometryBufferData =
  | Float32Array<ArrayBuffer>
  | Uint16Array<ArrayBuffer>
  | Uint32Array<ArrayBuffer>;

export type DepthResource = {
  texture: GPUTexture;
  view: GPUTextureView;
};

export type ShadowResources = {
  shadowTex: GPUTexture;
  shadowView: GPUTextureView;
  shadowLayerViews: GPUTextureView[];
  shadowSampler: GPUSampler;
  shadowSamplerLinear: GPUSampler;
};

export type VSMResources = {
  vsmMomentsTex: GPUTexture;
  vsmMomentsView: GPUTextureView;
  vsmMomentsLayerViews: GPUTextureView[];
  vsmTempTex: GPUTexture;
  vsmTempView: GPUTextureView;
  vsmTempLayerViews: GPUTextureView[];
  vsmBlurTex: GPUTexture;
  vsmBlurView: GPUTextureView;
  vsmBlurLayerViews: GPUTextureView[];
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
  layerCount: number,
  previous?: Partial<Pick<ShadowResources, 'shadowTex'>>
): ShadowResources {
  previous?.shadowTex?.destroy();

  const shadowTex = device.createTexture({
    size: { width: shadowSize, height: shadowSize, depthOrArrayLayers: layerCount },
    format: 'depth32float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });

  const shadowLayerViews = Array.from({ length: layerCount }, (_, index) =>
    shadowTex.createView({
      dimension: '2d',
      baseArrayLayer: index,
      arrayLayerCount: 1
    })
  );

  return {
    shadowTex,
    shadowView: shadowTex.createView({ dimension: '2d-array' }),
    shadowLayerViews,
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
  layerCount: number,
  previous?: Partial<Pick<VSMResources, 'vsmMomentsTex' | 'vsmTempTex' | 'vsmBlurTex'>>
): VSMResources {
  previous?.vsmMomentsTex?.destroy();
  previous?.vsmTempTex?.destroy();
  previous?.vsmBlurTex?.destroy();

  const vsmMomentsTex = device.createTexture({
    size: { width: shadowSize, height: shadowSize, depthOrArrayLayers: layerCount },
    format: 'rgba16float',
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING
  });

  const createBlurTexture = (label: string) => device.createTexture({
    label,
    size: { width: shadowSize, height: shadowSize, depthOrArrayLayers: layerCount },
    format: 'rgba16float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
  });

  const vsmTempTex = createBlurTexture('vsm horizontal blur texture');
  const vsmBlurTex = createBlurTexture('vsm final blur texture');

  const vsmMomentsLayerViews = Array.from({ length: layerCount }, (_, index) =>
    vsmMomentsTex.createView({
      dimension: '2d',
      baseArrayLayer: index,
      arrayLayerCount: 1
    })
  );
  const vsmTempLayerViews = Array.from({ length: layerCount }, (_, index) =>
    vsmTempTex.createView({
      dimension: '2d',
      baseArrayLayer: index,
      arrayLayerCount: 1
    })
  );
  const vsmBlurLayerViews = Array.from({ length: layerCount }, (_, index) =>
    vsmBlurTex.createView({
      dimension: '2d',
      baseArrayLayer: index,
      arrayLayerCount: 1
    })
  );

  return {
    vsmMomentsTex,
    vsmMomentsView: vsmMomentsTex.createView({ dimension: '2d-array' }),
    vsmMomentsLayerViews,
    vsmTempTex,
    vsmTempView: vsmTempTex.createView({ dimension: '2d-array' }),
    vsmTempLayerViews,
    vsmBlurTex,
    vsmBlurView: vsmBlurTex.createView({ dimension: '2d-array' }),
    vsmBlurLayerViews,
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
      size: SHADING_FLOATS * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    gridParamsBuf: device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    objectParamsBuf: device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    shadowMatsBuf: device.createBuffer({
      size: SHADOW_MATS_FLOATS * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    }),
    lightsBuf: device.createBuffer({
      size: LIGHTS_DATA_FLOATS * 4,
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
