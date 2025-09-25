import { mat4, vec3 } from 'gl-matrix';
import { initWebGPU } from '../gpu/initWebGPU';
import basicWGSL from '../shaders/basic.wgsl?raw';

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
  private depthTex!: GPUTexture;
  private depthView!: GPUTextureView;

  private vbo!: GPUBuffer;
  private nbo!: GPUBuffer;
  private ibo!: GPUBuffer;
  private indexCount = 0;

  private uniformBuf!: GPUBuffer;
  private bindGroup!: GPUBindGroup;

  private viewProj = mat4.create();
  private model = mat4.create();
  private lightDir = vec3.fromValues(0.5, 1.0, 0.3);

  private rafId = 0;
  private timeStart = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    this.gpu = await initWebGPU(this.canvas);
    this.createDepth();
    await this.createPipeline();
    this.createGeometry();
    this.createUniforms();
    this.updateViewProj();

    window.addEventListener('resize', () => {
      this.gpu.configure();
      this.createDepth();
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

  private async createPipeline() {
    const { device, format } = this.gpu;

    const shaderModule = device.createShaderModule({ code: basicWGSL });

    const vertexBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 3 * 4,
        attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
        stepMode: 'vertex'
      },
      {
        arrayStride: 3 * 4,
        attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }],
        stepMode: 'vertex'
      }
    ];

    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shaderModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
  }

  private createGeometry() {
    const { device } = this.gpu;
    // Куб 2x2x2: позиции и нормали по граням
    const positions = new Float32Array([
      // +Z (front)
      -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,
      // -Z (back)
      -1, -1, -1,  -1,  1, -1,   1,  1, -1,   1, -1, -1,
      // +X (right)
       1, -1, -1,   1,  1, -1,   1,  1,  1,   1, -1,  1,
      // -X (left)
      -1, -1, -1,  -1, -1,  1,  -1,  1,  1,  -1,  1, -1,
      // +Y (top)
      -1,  1,  1,   1,  1,  1,   1,  1, -1,  -1,  1, -1,
      // -Y (bottom)
      -1, -1,  1,  -1, -1, -1,   1, -1, -1,   1, -1,  1,
    ]);
    const normals = new Float32Array([
      // front
      0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
      // back
      0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
      // right
      1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
      // left
     -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      // top
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      // bottom
      0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
    ]);
    const indices = new Uint16Array([
      0,1,2,  0,2,3,       // front
      4,5,6,  4,6,7,       // back
      8,9,10, 8,10,11,     // right
      12,13,14, 12,14,15,  // left
      16,17,18, 16,18,19,  // top
      20,21,22, 20,22,23,  // bottom
    ]);
    this.indexCount = indices.length;

    this.vbo = device.createBuffer({
      size: positions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.vbo, 0, positions);

    this.nbo = device.createBuffer({
      size: normals.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.nbo, 0, normals);

    this.ibo = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.ibo, 0, indices);
  }

  private createUniforms() {
    const { device } = this.gpu;
    // model(64) + viewProj(64) + lightDir(16) = 144 → выровняем до 160
    const uniformSize = 16 * 4 * 2 + 4 * 4; // 144 байт
    this.uniformBuf = device.createBuffer({
      size: Math.ceil(uniformSize / 16) * 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const bindLayout = this.pipeline.getBindGroupLayout(0);
    this.bindGroup = device.createBindGroup({
      layout: bindLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });
  }

  private updateViewProj() {
    const aspect = this.canvas.width / this.canvas.height;
    const proj = mat4.create();
    mat4.perspective(proj, (60 * Math.PI) / 180, aspect, 0.1, 100.0);
    const view = mat4.create();
    const eye = vec3.fromValues(3, 2.5, 4);
    const center = vec3.fromValues(0, 0, 0);
    const up = vec3.fromValues(0, 1, 0);
    mat4.lookAt(view, eye, center, up);
    mat4.multiply(this.viewProj, proj, view);
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

  private frame() {
    const { device, context } = this.gpu;
    const now = performance.now();
    const t = (now - this.timeStart) / 1000;

    // Анимация модели (вращение)
    mat4.identity(this.model);
    mat4.rotateY(this.model, this.model, t * 0.7);
    mat4.rotateX(this.model, this.model, t * 0.4);

    // Обновление uniform-буфера
    // model (64) + viewProj (64) + lightDir (16)
    const tmp = new Float32Array(16 * 2 + 4);
    tmp.set(this.model, 0);
    tmp.set(this.viewProj, 16);
    tmp.set([this.lightDir[0], this.lightDir[1], this.lightDir[2], 0], 32);
    device.queue.writeBuffer(this.uniformBuf, 0, tmp.buffer);

    const colorView = context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: colorView,
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

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vbo);
    pass.setVertexBuffer(1, this.nbo);
    pass.setIndexBuffer(this.ibo, 'uint16');
    pass.setBindGroup(0, this.bindGroup);
    pass.drawIndexed(this.indexCount, 1, 0, 0, 0);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }
}
