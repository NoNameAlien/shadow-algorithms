import { shaders } from './shaderSources';

export type RendererPipelines = {
  pipelineSM: GPURenderPipeline;
  pipelinePCF: GPURenderPipeline;
  pipelinePCSS: GPURenderPipeline;
  pipelineVSM: GPURenderPipeline;
  vsmMomentsPipeline: GPURenderPipeline;
  blurHorizontalPipeline: GPUComputePipeline;
  shadowPipeline: GPURenderPipeline;
  gridPipeline: GPURenderPipeline;
  lightBeamPipeline: GPURenderPipeline;
  axisPipeline: GPURenderPipeline;
};

export function createRendererPipelines(device: GPUDevice, format: GPUTextureFormat): RendererPipelines {
  const posLayout: GPUVertexBufferLayout = {
    arrayStride: 3 * 4,
    attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }]
  };

  const mainVertexBuffers: GPUVertexBufferLayout[] = [
    { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
    { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] },
    { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, format: 'float32x2', offset: 0 }] }
  ];

  const depthModule = device.createShaderModule({ code: shaders.depth });
  const shadowPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: depthModule, entryPoint: 'vs_main', buffers: [posLayout] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
  });
  console.log('✓ Shadow pipeline created');

  const smModule = device.createShaderModule({ code: shaders.basic });
  const pipelineSM = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: smModule, entryPoint: 'vs_main', buffers: mainVertexBuffers },
    fragment: { module: smModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  console.log('✓ SM pipeline created');

  const pcfModule = device.createShaderModule({ code: shaders.pcf });
  const pipelinePCF = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: pcfModule, entryPoint: 'vs_main', buffers: mainVertexBuffers },
    fragment: { module: pcfModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  console.log('✓ PCF pipeline created');

  const pcssModule = device.createShaderModule({ code: shaders.pcss });
  const pipelinePCSS = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: pcssModule, entryPoint: 'vs_main', buffers: mainVertexBuffers },
    fragment: { module: pcssModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  console.log('✓ PCSS pipeline created');

  const vsmMomentsModule = device.createShaderModule({ code: shaders.vsmMoments });
  const vsmMomentsPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: vsmMomentsModule, entryPoint: 'vs_main', buffers: [posLayout] },
    fragment: { module: vsmMomentsModule, entryPoint: 'fs_main', targets: [{ format: 'rgba16float' }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
  });
  console.log('✓ VSM moments pipeline created');

  const vsmModule = device.createShaderModule({ code: shaders.vsm });
  const pipelineVSM = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: vsmModule, entryPoint: 'vs_main', buffers: mainVertexBuffers },
    fragment: { module: vsmModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  console.log('✓ VSM pipeline created');

  const blurModule = device.createShaderModule({ code: shaders.vsmBlur });
  const blurHorizontalPipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: blurModule, entryPoint: 'cs_horizontal' }
  });
  console.log('✓ Blur pipeline created');

  const gridSolidModule = device.createShaderModule({ code: shaders.gridSolid });
  const gridPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: gridSolidModule, entryPoint: 'vs_main', buffers: mainVertexBuffers },
    fragment: {
      module: gridSolidModule,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
        }
      }]
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
  });
  console.log('✓ Grid pipeline created');

  const axisModule = device.createShaderModule({ code: shaders.axisGizmo });
  const axisPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: axisModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 6 * 4,
        attributes: [
          { shaderLocation: 0, format: 'float32x3', offset: 0 },
          { shaderLocation: 1, format: 'float32x3', offset: 3 * 4 }
        ]
      }]
    },
    fragment: { module: axisModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'line-list', cullMode: 'none' }
  });
  console.log('✓ Axis gizmo pipeline created');

  const beamModule = device.createShaderModule({ code: shaders.lightBeam });
  const lightBeamPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: beamModule,
      entryPoint: 'vs_main',
      buffers: [{ arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] }]
    },
    fragment: { module: beamModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'line-list', cullMode: 'none' }
  });
  console.log('✓ Light beam pipeline created');

  return {
    pipelineSM,
    pipelinePCF,
    pipelinePCSS,
    pipelineVSM,
    vsmMomentsPipeline,
    blurHorizontalPipeline,
    shadowPipeline,
    gridPipeline,
    lightBeamPipeline,
    axisPipeline
  };
}
