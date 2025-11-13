import { mat4, vec3 } from 'gl-matrix';
import { initWebGPU } from '../gpu/initWebGPU';
import basicWGSL from '../shaders/basic.wgsl?raw';
import pcfWGSL from '../shaders/pcf.wgsl?raw';
import pcssWGSL from '../shaders/pcss.wgsl?raw';
import depthWGSL from '../shaders/depth.wgsl?raw';
import vsmMomentsWGSL from '../shaders/vsm_moments.wgsl?raw';
import vsmBlurWGSL from '../shaders/vsm_blur.wgsl?raw';
import vsmWGSL from '../shaders/vsm.wgsl?raw';
import { ArcballController } from './ArcballController';
import { ModelLoader } from '../loaders/ModelLoader';
import gridSolidWGSL from '../shaders/grid_solid.wgsl?raw';
import lightSphereWGSL from '../shaders/light_sphere.wgsl?raw';
import { SphereGenerator } from '../geometry/SphereGenerator';
import { LightDragger } from './LightDragger';

type GPUCtx = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  configure: () => void;
};

export type ShadowMethod = 'SM' | 'PCF' | 'PCSS' | 'VSM';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private gpu!: GPUCtx;
  private pipelineSM!: GPURenderPipeline;
  private pipelinePCF!: GPURenderPipeline;
  private pipelinePCSS!: GPURenderPipeline;
  private pipelineVSM!: GPURenderPipeline;
  private vsmMomentsPipeline!: GPURenderPipeline;
  private blurHorizontalPipeline!: GPUComputePipeline;
  private shadowPipeline!: GPURenderPipeline;
  private depthTex!: GPUTexture;
  private depthView!: GPUTextureView;
  private arcball!: ArcballController; // ДОБАВЛЕНО
  private lastFrameTime = performance.now();
  private gridNBO!: GPUBuffer;
  private lightDragger!: LightDragger;

  private shadowSize = 2048;
  private shadowTex!: GPUTexture;
  private shadowView!: GPUTextureView;
  private shadowSampler!: GPUSampler;
  private shadowSamplerLinear!: GPUSampler; // для чтения depth в PCSS

  // VSM текстуры
  private vsmMomentsTex!: GPUTexture;
  private vsmMomentsView!: GPUTextureView;
  private vsmBlurTex!: GPUTexture;
  private vsmBlurView!: GPUTextureView;
  private vsmSampler!: GPUSampler;

  private lightSpherePipeline!: GPURenderPipeline;
  private lightSphereVBO!: GPUBuffer;
  private lightSphereIBO!: GPUBuffer;
  private lightSphereIndexCount = 0;
  private lightSphereBindGroup!: GPUBindGroup;

  private vbo!: GPUBuffer;
  private nbo!: GPUBuffer;
  private ibo!: GPUBuffer;
  private indexCount = 0;

  private uniformBuf!: GPUBuffer;
  private bindGroup0Main!: GPUBindGroup;
  private bindGroup0Shadow!: GPUBindGroup;
  private bindGroup0VSMMoments!: GPUBindGroup;
  private bindGroup1Main!: GPUBindGroup;
  private vsmBlurBindGroup0!: GPUBindGroup; // input -> output

  private gridPipeline!: GPURenderPipeline;
  private gridVBO!: GPUBuffer;
  private gridBindGroup!: GPUBindGroup;
  private gridBindGroup1!: GPUBindGroup;

  private viewProj = mat4.create();
  private model = mat4.create();
  private lightDir = vec3.fromValues(0.5, 1.0, 0.3);
  private lightViewProj = mat4.create();

  private rafId = 0;

  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 0;
  private fpsCallback?: (fps: number) => void;

  private shadowParams = {
    shadowMapSize: 2048,
    bias: 0.005,
    method: 'SM' as ShadowMethod,
    pcfRadius: 2.0,
    pcfSamples: 16,
    pcssLightSize: 0.05,
    pcssBlockerSearchSamples: 16,
    vsmMinVariance: 0.00001,
    vsmLightBleedReduction: 0.3
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    this.gpu = await initWebGPU(this.canvas);
    this.arcball = new ArcballController(this.canvas);

    this.createDepth();
    this.createShadowResources();
    this.createVSMResources();
    await this.createPipelines();
    this.createGeometry();
    this.createGrid();
    this.createLightSphere();
    this.createUniforms();
    this.updateViewProj();
    this.updateLightViewProj();

    // ДОБАВЬ: Light dragger
    const cameraPos = vec3.fromValues(4, 3.5, 5);
    this.lightDragger = new LightDragger(
      this.canvas,
      this.viewProj,
      cameraPos,
      (newLightDir) => {
        // Callback: обновляем направление света
        vec3.copy(this.lightDir, newLightDir);
        this.updateLightViewProj(); // Пересчитываем shadow map
      }
    );

    window.addEventListener('resize', () => {
      this.gpu.configure();
      this.createDepth();
      this.recreateBindGroups();
      this.updateViewProj();
    });
  }



  setFpsCallback(callback: (fps: number) => void) {
    this.fpsCallback = callback;
  }

  private createDepth() {
    const { device } = this.gpu;
    if (this.depthTex) this.depthTex.destroy();
    this.depthTex = device.createTexture({
      size: { width: this.canvas.width, height: this.canvas.height },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.depthView = this.depthTex.createView();
  }

  private createShadowResources() {
    const { device } = this.gpu;
    if (this.shadowTex) this.shadowTex.destroy();
    this.shadowTex = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    this.shadowView = this.shadowTex.createView();

    this.shadowSampler = device.createSampler({
      compare: 'less',
      magFilter: 'linear',
      minFilter: 'linear'
    });

    // Линейный сэмплер для чтения depth (PCSS)
    this.shadowSamplerLinear = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });

    console.log('✓ Shadow resources created');
  }

  private async createPipelines() {
    const { device, format } = this.gpu;

    const depthModule = device.createShaderModule({ code: depthWGSL });
    const posLayout: GPUVertexBufferLayout = {
      arrayStride: 3 * 4,
      attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }]
    };
    this.shadowPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: depthModule, entryPoint: 'vs_main', buffers: [posLayout] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ Shadow pipeline created');

    const vertexBuffers: GPUVertexBufferLayout[] = [
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] }
    ];

    const smModule = device.createShaderModule({ code: basicWGSL });
    this.pipelineSM = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: smModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: smModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ SM pipeline created');

    const pcfModule = device.createShaderModule({ code: pcfWGSL });
    this.pipelinePCF = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: pcfModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: pcfModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ PCF pipeline created');

    const pcssModule = device.createShaderModule({ code: pcssWGSL });
    this.pipelinePCSS = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: pcssModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: pcssModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ PCSS pipeline created');

    // VSM moments pipeline
    const vsmMomentsModule = device.createShaderModule({ code: vsmMomentsWGSL });
    this.vsmMomentsPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: vsmMomentsModule, entryPoint: 'vs_main', buffers: [posLayout] },
      fragment: {
        module: vsmMomentsModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'rgba16float' }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ VSM moments pipeline created');


    // VSM shading pipeline
    const vsmModule = device.createShaderModule({ code: vsmWGSL });
    this.pipelineVSM = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: vsmModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: vsmModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ VSM pipeline created');

    // Blur compute pipelines
    const blurModule = device.createShaderModule({ code: vsmBlurWGSL });
    this.blurHorizontalPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: blurModule, entryPoint: 'cs_horizontal' }
    });
    console.log('✓ Blur pipelines created');

    // Grid pipeline с нормалями и shadow mapping
    const gridSolidModule = device.createShaderModule({ code: gridSolidWGSL });
    const gridBuffers: GPUVertexBufferLayout[] = [
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] }
    ];
    this.gridPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: gridSolidModule, entryPoint: 'vs_main', buffers: gridBuffers },
      fragment: {
        module: gridSolidModule,
        entryPoint: 'fs_main',
        targets: [{
          format,
          blend: { // alpha blending для затухания
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });
    console.log('✓ Grid pipeline created');

    // Light sphere pipeline (unlit)
    const lightSphereModule = device.createShaderModule({ code: lightSphereWGSL });
    const spherePosLayout: GPUVertexBufferLayout = {
      arrayStride: 3 * 4,
      attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }]
    };
    this.lightSpherePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: lightSphereModule, entryPoint: 'vs_main', buffers: [spherePosLayout] },
      fragment: {
        module: lightSphereModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });
    console.log('✓ Light sphere pipeline created');
  }

  private createVSMResources() {
    const { device } = this.gpu;

    // Текстура моментов (RGBA16F вместо RG32F — filterable!)
    if (this.vsmMomentsTex) this.vsmMomentsTex.destroy();
    this.vsmMomentsTex = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: 'rgba16float', // ИЗМЕНЕНО с rg32float
      usage: GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING
    });
    this.vsmMomentsView = this.vsmMomentsTex.createView();

    // Временная текстура для blur (ping-pong)
    if (this.vsmBlurTex) this.vsmBlurTex.destroy();
    this.vsmBlurTex = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: 'rgba16float', // ИЗМЕНЕНО с rg32float
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
    });
    this.vsmBlurView = this.vsmBlurTex.createView();

    this.vsmSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });

    console.log('✓ VSM resources created');
  }

  private createGeometry() {
    const { device } = this.gpu;
    const positions = new Float32Array([
      // Куб 2x2x2 (от -1 до 1)
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
      -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1,
      1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1,
      -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1,
      -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,
      -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1,
    ]);
    const normals = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    ]);
    // indices не меняются
    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
    ]);
    this.indexCount = indices.length;

    this.vbo = device.createBuffer({ size: positions.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.vbo, 0, positions);

    this.nbo = device.createBuffer({ size: normals.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.nbo, 0, normals);

    this.ibo = device.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.ibo, 0, indices);
  }

  private createGrid() {
    const { device } = this.gpu;

    // Большая плоскость 20×20 с нормалями (для теней)
    const gridPos = new Float32Array([
      -10, -2.5, -10, 10, -2.5, -10, 10, -2.5, 10,
      -10, -2.5, -10, 10, -2.5, 10, -10, -2.5, 10
    ]);

    const gridNorm = new Float32Array([
      0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0
    ]);

    this.gridVBO = device.createBuffer({
      size: gridPos.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.gridVBO, 0, gridPos);

    // НОВОЕ: буфер нормалей для grid
    this.gridNBO = device.createBuffer({
      size: gridNorm.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.gridNBO, 0, gridNorm);
  }

  private createLightSphere() {
    const { device } = this.gpu;

    // Генерируем icosphere радиус 0.3, 1 subdivision
    const sphere = SphereGenerator.createIcosphere(0.8, 1);
    this.lightSphereIndexCount = sphere.indices.length;

    this.lightSphereVBO = device.createBuffer({
      size: sphere.positions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightSphereVBO, 0, sphere.positions.buffer);

    this.lightSphereIBO = device.createBuffer({
      size: sphere.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightSphereIBO, 0, sphere.indices.buffer);

    console.log('✓ Light sphere geometry created');
  }


  private createUniforms() {
    const { device } = this.gpu;
    const uniformSize = 16 * 4 * 3 + 4 * 4 * 2;
    this.uniformBuf = device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.recreateBindGroups();
  }

  private recreateBindGroups() {
    const { device } = this.gpu;

    let currentPipeline = this.pipelineSM;
    if (this.shadowParams.method === 'PCF') currentPipeline = this.pipelinePCF;
    if (this.shadowParams.method === 'PCSS') currentPipeline = this.pipelinePCSS;
    if (this.shadowParams.method === 'VSM') currentPipeline = this.pipelineVSM;

    this.bindGroup0Shadow = device.createBindGroup({
      layout: this.shadowPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

    this.bindGroup0VSMMoments = device.createBindGroup({
      layout: this.vsmMomentsPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

    this.bindGroup0Main = device.createBindGroup({
      layout: currentPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

    if (this.shadowParams.method === 'PCSS') {
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler },
          { binding: 2, resource: this.shadowSamplerLinear }
        ]
      });
    } else if (this.shadowParams.method === 'VSM') {
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.vsmBlurView },
          { binding: 1, resource: this.vsmSampler }
        ]
      });
    } else {
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler }
        ]
      });
    }

    this.vsmBlurBindGroup0 = device.createBindGroup({
      layout: this.blurHorizontalPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.vsmMomentsView },
        { binding: 1, resource: this.vsmBlurView }
      ]
    });

    // ИСПРАВЛЕНО: Grid bind groups из СВОЕГО pipeline layout
    this.gridBindGroup = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

    // ДОБАВЛЕНО: Grid group(1) bind group
    this.gridBindGroup1 = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: this.shadowView },
        { binding: 1, resource: this.shadowSampler }
      ]
    });

    // Light sphere bind group
    this.lightSphereBindGroup = device.createBindGroup({
      layout: this.lightSpherePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

  }


  private updateViewProj() {
    const aspect = this.canvas.width / this.canvas.height;
    const proj = mat4.create();
    mat4.perspective(proj, (60 * Math.PI) / 180, aspect, 0.1, 100.0);
    const view = mat4.create();
    const eye = vec3.fromValues(4, 3.5, 5);
    mat4.lookAt(view, eye, [0, 0, 0], [0, 1, 0]);
    mat4.multiply(this.viewProj, proj, view);

    if (this.lightDragger) {
      this.lightDragger.updateCamera(this.viewProj, eye);
    }
  }


  private updateLightViewProj() {
    const lightPos = vec3.create();
    vec3.scale(lightPos, this.lightDir, 10);
    const lightView = mat4.create();
    mat4.lookAt(lightView, lightPos, [0, 0, 0], [0, 1, 0]);
    const lightProj = mat4.create();
    mat4.ortho(lightProj, -6, 6, -6, 6, 1, 20);
    mat4.multiply(this.lightViewProj, lightProj, lightView);
  }

  // private createLightSphere() {
  //   // Icosphere (20 треугольников) для визуализации света
  //   const phi = (1 + Math.sqrt(5)) / 2;
  //   const vertices = [
  //     -1, phi, 0, 1, phi, 0, -1, -phi, 0, 1, -phi, 0,
  //     0, -1, phi, 0, 1, phi, 0, -1, -phi, 0, 1, -phi,
  //     phi, 0, -1, phi, 0, 1, -phi, 0, -1, -phi, 0, 1
  //   ];

  //   // Нормализация и масштаб 0.3
  //   const scale = 0.3 / Math.sqrt(1 + phi * phi);
  //   const spherePos = new Float32Array(vertices.map(v => v * scale));

  //   this.lightSphereVBO = device.createBuffer({
  //     size: spherePos.byteLength,
  //     usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  //   });
  //   device.queue.writeBuffer(this.lightSphereVBO, 0, spherePos);
  // }

  // private createGrid() {
  //   // Большая плоскость для сетки (20×20)
  //   const gridPos = new Float32Array([
  //     -10, 0, -10, 10, 0, -10, 10, 0, 10,
  //     -10, 0, -10, 10, 0, 10, -10, 0, 10
  //   ]);

  //   this.gridVBO = device.createBuffer({
  //     size: gridPos.byteLength,
  //     usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  //   });
  //   device.queue.writeBuffer(this.gridVBO, 0, gridPos);
  // }

  // // В frame() рендерь сетку первой с alpha blending
  // private renderGrid(encoder: GPUCommandEncoder) {
  //   const pass = encoder.beginRenderPass({
  //     colorAttachments: [{
  //       view: this.colorView,
  //       loadOp: 'load', // не очищаем
  //       storeOp: 'store'
  //     }]
  //   });

  //   pass.setPipeline(this.gridPipeline);
  //   pass.setVertexBuffer(0, this.gridVBO);
  //   pass.setBindGroup(0, this.gridBindGroup);
  //   pass.draw(6); // 2 треугольника
  //   pass.end();
  // }


  start() {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  destroy() {
    this.stop();
    if (this.depthTex) this.depthTex.destroy();
    if (this.shadowTex) this.shadowTex.destroy();
    if (this.vsmMomentsTex) this.vsmMomentsTex.destroy();
    if (this.vsmBlurTex) this.vsmBlurTex.destroy();
    if (this.vbo) this.vbo.destroy();
    if (this.nbo) this.nbo.destroy();
    if (this.ibo) this.ibo.destroy();
    if (this.uniformBuf) this.uniformBuf.destroy();
    if (this.lightSphereVBO) this.lightSphereVBO.destroy();
    if (this.lightSphereIBO) this.lightSphereIBO.destroy();
    console.log('✓ Renderer destroyed');
  }


  private frame() {
    const { device, context } = this.gpu;

    this.frameCount++;
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (now - this.lastFpsUpdate > 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      if (this.fpsCallback) {
        this.fpsCallback(this.currentFps);
      }
    }

    this.model = this.arcball.update(deltaTime);

    const lightDirNorm = vec3.create();
    vec3.normalize(lightDirNorm, this.lightDir);

    const tmp = new Float32Array(16 * 3 + 4 * 2);
    tmp.set(this.model, 0);
    tmp.set(this.viewProj, 16);
    tmp.set(this.lightViewProj, 32);
    tmp.set([lightDirNorm[0], lightDirNorm[1], lightDirNorm[2], 0], 48);

    if (this.shadowParams.method === 'PCSS') {
      tmp.set([
        this.shadowParams.bias,
        this.shadowParams.pcssLightSize,
        this.shadowParams.pcssBlockerSearchSamples,
        this.shadowParams.shadowMapSize
      ], 52);
    } else if (this.shadowParams.method === 'VSM') {
      tmp.set([
        this.shadowParams.vsmMinVariance,
        this.shadowParams.vsmLightBleedReduction,
        0,
        0
      ], 52);
    } else {
      tmp.set([
        this.shadowParams.bias,
        this.shadowParams.pcfRadius,
        this.shadowParams.pcfSamples,
        this.shadowParams.shadowMapSize
      ], 52);
    }

    device.queue.writeBuffer(this.uniformBuf, 0, tmp.buffer);

    const encoder = device.createCommandEncoder();

    // Shadow pass
    if (this.shadowParams.method === 'VSM') {
      const vsmPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.vsmMomentsView,
          clearValue: { r: 1.0, g: 1.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: this.shadowView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });
      vsmPass.setPipeline(this.vsmMomentsPipeline);
      vsmPass.setVertexBuffer(0, this.vbo);
      vsmPass.setIndexBuffer(this.ibo, 'uint16');
      vsmPass.setBindGroup(0, this.bindGroup0VSMMoments);
      vsmPass.drawIndexed(this.indexCount);
      vsmPass.end();

      const blurH = encoder.beginComputePass();
      blurH.setPipeline(this.blurHorizontalPipeline);
      blurH.setBindGroup(0, this.vsmBlurBindGroup0);
      const workgroupsX = Math.ceil(this.shadowSize / 8);
      const workgroupsY = Math.ceil(this.shadowSize / 8);
      blurH.dispatchWorkgroups(workgroupsX, workgroupsY);
      blurH.end();
    } else {
      const shadowPass = encoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: this.shadowView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });
      shadowPass.setPipeline(this.shadowPipeline);

      // Основная геометрия (indexed)
      shadowPass.setVertexBuffer(0, this.vbo);
      shadowPass.setIndexBuffer(this.ibo, 'uint16');
      shadowPass.setBindGroup(0, this.bindGroup0Shadow);
      shadowPass.drawIndexed(this.indexCount);

      // Grid (non-indexed) - НЕ устанавливаем index buffer!
      shadowPass.setVertexBuffer(0, this.gridVBO);
      shadowPass.setBindGroup(0, this.bindGroup0Shadow);
      shadowPass.draw(6);

      shadowPass.end();
    }

    // Main pass
    let currentPipeline = this.pipelineSM;
    if (this.shadowParams.method === 'PCF') currentPipeline = this.pipelinePCF;
    if (this.shadowParams.method === 'PCSS') currentPipeline = this.pipelinePCSS;
    if (this.shadowParams.method === 'VSM') currentPipeline = this.pipelineVSM;

    const mainPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.08, g: 0.09, b: 0.11, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: this.depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });
    mainPass.setPipeline(currentPipeline);
    mainPass.setVertexBuffer(0, this.vbo);
    mainPass.setVertexBuffer(1, this.nbo);
    mainPass.setIndexBuffer(this.ibo, 'uint16');
    mainPass.setBindGroup(0, this.bindGroup0Main);
    mainPass.setBindGroup(1, this.bindGroup1Main);
    mainPass.drawIndexed(this.indexCount);
    mainPass.end();

    // Grid pass
    const gridPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'load',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: this.depthView,
        depthLoadOp: 'load',
        depthStoreOp: 'store'
      }
    });
    gridPass.setPipeline(this.gridPipeline);
    gridPass.setVertexBuffer(0, this.gridVBO);
    gridPass.setVertexBuffer(1, this.gridNBO);
    gridPass.setBindGroup(0, this.gridBindGroup);
    gridPass.setBindGroup(1, this.gridBindGroup1);
    gridPass.draw(6);
    gridPass.end();

    // Light sphere pass (рендерим последним поверх всего)
    const spherePass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'load', // НЕ очищаем
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: this.depthView,
        depthLoadOp: 'load',
        depthStoreOp: 'store'
      }
    });
    spherePass.setPipeline(this.lightSpherePipeline);
    spherePass.setVertexBuffer(0, this.lightSphereVBO);
    spherePass.setIndexBuffer(this.lightSphereIBO, 'uint16');
    spherePass.setBindGroup(0, this.lightSphereBindGroup);
    spherePass.drawIndexed(this.lightSphereIndexCount);
    spherePass.end();

    device.queue.submit([encoder.finish()]);
  }

  updateShadowParams(params: {
    shadowMapSize: number;
    bias: number;
    method: ShadowMethod;
    pcfRadius?: number;
    pcfSamples?: number;
    pcssLightSize?: number;
    pcssBlockerSearchSamples?: number;
    vsmMinVariance?: number;
    vsmLightBleedReduction?: number;
  }) {
    const methodChanged = params.method !== this.shadowParams.method;
    const sizeChanged = params.shadowMapSize !== this.shadowSize;

    // Обновляем параметры
    this.shadowParams = {
      ...this.shadowParams,
      ...params,
      pcfRadius: params.pcfRadius ?? this.shadowParams.pcfRadius,
      pcfSamples: params.pcfSamples ?? this.shadowParams.pcfSamples,
      pcssLightSize: params.pcssLightSize ?? this.shadowParams.pcssLightSize,
      pcssBlockerSearchSamples: params.pcssBlockerSearchSamples ?? this.shadowParams.pcssBlockerSearchSamples,
      vsmMinVariance: params.vsmMinVariance ?? this.shadowParams.vsmMinVariance,
      vsmLightBleedReduction: params.vsmLightBleedReduction ?? this.shadowParams.vsmLightBleedReduction
    };

    // Пересоздаём ресурсы если изменился размер
    if (sizeChanged) {
      this.shadowSize = params.shadowMapSize;
      this.createShadowResources();
      this.createVSMResources();
    }

    // ВАЖНО: Пересоздаём bind groups при смене метода или размера
    if (methodChanged || sizeChanged) {
      this.recreateBindGroups();
      console.log(`Switched to ${params.method}, bind groups recreated`);
    }
  }

  async loadModel(file: File) {
    const loader = new ModelLoader();

    try {
      const url = URL.createObjectURL(file);
      const model = await loader.loadOBJ(url);
      URL.revokeObjectURL(url);

      // Заменяем текущую геометрию
      const { device } = this.gpu;

      // Добавляем плоскость к загруженной модели
      const planeStart = model.positions.length / 3;
      const planePos = new Float32Array([
        -4, -2.5, -4, 4, -2.5, -4, 4, -2.5, 4, -4, -2.5, 4  // y=-2.5
      ]);
      const planeNorm = new Float32Array([
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0
      ]);
      const planeIdx = new Uint16Array([
        planeStart, planeStart + 1, planeStart + 2,
        planeStart, planeStart + 2, planeStart + 3
      ]);

      // Объединяем модель + плоскость
      const finalPos = new Float32Array(model.positions.length + planePos.length);
      finalPos.set(model.positions);
      finalPos.set(planePos, model.positions.length);

      const finalNorm = new Float32Array(model.normals.length + planeNorm.length);
      finalNorm.set(model.normals);
      finalNorm.set(planeNorm, model.normals.length);

      const finalIdx = new Uint16Array(model.indices.length + planeIdx.length);
      finalIdx.set(model.indices);
      finalIdx.set(planeIdx, model.indices.length);

      // Обновляем буферы
      if (this.vbo) this.vbo.destroy();
      if (this.nbo) this.nbo.destroy();
      if (this.ibo) this.ibo.destroy();

      this.vbo = device.createBuffer({
        size: finalPos.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(this.vbo, 0, finalPos);

      this.nbo = device.createBuffer({
        size: finalNorm.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(this.nbo, 0, finalNorm);

      this.ibo = device.createBuffer({
        size: finalIdx.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(this.ibo, 0, finalIdx);

      this.indexCount = finalIdx.length;

      console.log(`✓ Loaded OBJ: ${model.positions.length / 3} vertices, ${model.indices.length / 3} triangles`);
    } catch (e) {
      console.error('Failed to load OBJ:', e);
      alert(`Ошибка загрузки модели: ${e}`);
    }
  }
}
