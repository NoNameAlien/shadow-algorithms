import { mat4, vec3 } from 'gl-matrix';
import { initWebGPU } from '../gpu/initWebGPU';
import basicWGSL from '../shaders/basic.wgsl?raw';
import depthWGSL from '../shaders/depth.wgsl?raw';

type GPUCtx = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  configure: () => void;
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private gpu!: GPUCtx;
  private pipeline!: GPURenderPipeline;
  private shadowPipeline!: GPURenderPipeline;
  private depthTex!: GPUTexture;
  private depthView!: GPUTextureView;

  private shadowSize = 2048;
  private shadowTex!: GPUTexture;
  private shadowView!: GPUTextureView;
  private shadowSampler!: GPUSampler;

  private vbo!: GPUBuffer;
  private nbo!: GPUBuffer;
  private ibo!: GPUBuffer;
  private indexCount = 0;

  private uniformBuf!: GPUBuffer;
  private bindGroup0Main!: GPUBindGroup;
  private bindGroup0Shadow!: GPUBindGroup;
  private bindGroup1Main!: GPUBindGroup;

  private viewProj = mat4.create();
  private model = mat4.create();
  private lightDir = vec3.fromValues(-0.5, -1.0, -0.3);
  private lightViewProj = mat4.create();

  private rafId = 0;
  private timeStart = performance.now();

  private shadowParams = { shadowMapSize: 2048, bias: 0.005, method: 'SM' as const };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    this.gpu = await initWebGPU(this.canvas);
    this.createDepth();
    this.createShadowResources();
    await this.createPipelines();
    this.createGeometry();
    this.createUniforms();
    this.updateViewProj();
    this.updateLightViewProj();

    window.addEventListener('resize', () => {
      this.gpu.configure();
      this.createDepth();
      this.recreateBindGroups(); // НОВОЕ: пересоздаем bind groups
      this.updateViewProj();
    });
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

    const shaderModule = device.createShaderModule({ code: basicWGSL });
    const vertexBuffers: GPUVertexBufferLayout[] = [
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] }
    ];
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shaderModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ Main pipeline created');
  }

  private createGeometry() {
    const { device } = this.gpu;
    // Куб + небольшая плоскость под ним
    const positions = new Float32Array([
      // Куб (центр в (0,0,0))
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
      -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1,
      1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1,
      -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1,
      -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,
      -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1,
      // Плоскость (y=-1.5, меньший размер)
      -4, -1.5, -4, 4, -1.5, -4, 4, -1.5, 4, -4, -1.5, 4,
    ]);
    const normals = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, // нормаль плоскости вверх
    ]);
    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
      24, 25, 26, 24, 26, 27,
    ]);
    this.indexCount = indices.length;

    this.vbo = device.createBuffer({ size: positions.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.vbo, 0, positions);

    this.nbo = device.createBuffer({ size: normals.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.nbo, 0, normals);

    this.ibo = device.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.ibo, 0, indices);
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

  // НОВОЕ: выделено в отдельный метод для вызова при resize
  private recreateBindGroups() {
    const { device } = this.gpu;

    this.bindGroup0Shadow = device.createBindGroup({
      layout: this.shadowPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

    this.bindGroup0Main = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

    this.bindGroup1Main = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: this.shadowView },
        { binding: 1, resource: this.shadowSampler }
      ]
    });
  }

  private updateViewProj() {
    const aspect = this.canvas.width / this.canvas.height;
    const proj = mat4.create();
    mat4.perspective(proj, (60 * Math.PI) / 180, aspect, 0.1, 100.0);
    const view = mat4.create();
    mat4.lookAt(view, [3, 2.5, 4], [0, 0, 0], [0, 1, 0]);
    mat4.multiply(this.viewProj, proj, view);
  }

  private updateLightViewProj() {
    const lightPos = vec3.create();
    vec3.scale(lightPos, this.lightDir, -10);
    const lightView = mat4.create();
    mat4.lookAt(lightView, lightPos, [0, 0, 0], [0, 1, 0]);
    const lightProj = mat4.create();
    mat4.ortho(lightProj, -6, 6, -6, 6, 1, 20);
    mat4.multiply(this.lightViewProj, lightProj, lightView);
  }

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
    if (this.vbo) this.vbo.destroy();
    if (this.nbo) this.nbo.destroy();
    if (this.ibo) this.ibo.destroy();
    if (this.uniformBuf) this.uniformBuf.destroy();
    console.log('✓ Renderer destroyed');
  }

  private frame() {
    const { device, context } = this.gpu;
    const t = (performance.now() - this.timeStart) / 1000;

    mat4.identity(this.model);
    mat4.rotateY(this.model, this.model, t * 0.7);
    mat4.rotateX(this.model, this.model, t * 0.4);

    const lightDirNorm = vec3.create();
    vec3.normalize(lightDirNorm, this.lightDir);

    const tmp = new Float32Array(16 * 3 + 4 * 2);
    tmp.set(this.model, 0);
    tmp.set(this.viewProj, 16);
    tmp.set(this.lightViewProj, 32);
    tmp.set([lightDirNorm[0], lightDirNorm[1], lightDirNorm[2], 0], 48);
    tmp.set([this.shadowParams.bias, 0, 0, 0], 52);
    device.queue.writeBuffer(this.uniformBuf, 0, tmp.buffer);

    const encoder = device.createCommandEncoder();

    // Shadow pass
    const shadowPass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: { view: this.shadowView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
    });
    shadowPass.setPipeline(this.shadowPipeline);
    shadowPass.setVertexBuffer(0, this.vbo);
    shadowPass.setIndexBuffer(this.ibo, 'uint16');
    shadowPass.setBindGroup(0, this.bindGroup0Shadow);
    shadowPass.drawIndexed(this.indexCount);
    shadowPass.end();

    const mainPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.08, g: 0.09, b: 0.11, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: { view: this.depthView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
    });
    mainPass.setPipeline(this.pipeline);
    mainPass.setVertexBuffer(0, this.vbo);
    mainPass.setVertexBuffer(1, this.nbo);
    mainPass.setIndexBuffer(this.ibo, 'uint16');
    mainPass.setBindGroup(0, this.bindGroup0Main);
    mainPass.setBindGroup(1, this.bindGroup1Main);
    mainPass.drawIndexed(this.indexCount);
    mainPass.end();

    device.queue.submit([encoder.finish()]);
  }

  updateShadowParams(params: { shadowMapSize: number; bias: number; method: string }) {
    this.shadowParams = params as any;
    if (params.shadowMapSize !== this.shadowSize) {
      this.shadowSize = params.shadowMapSize;
      this.createShadowResources();
      this.recreateBindGroups();
    }
  }
}
