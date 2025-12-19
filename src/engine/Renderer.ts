import { mat4, vec3, vec4 } from 'gl-matrix';
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
import { CameraController } from './CameraController';
import axisGizmoWGSL from '../shaders/axis_gizmo.wgsl?raw';

type GPUCtx = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  configure: () => void;
};
type Selection = 'none' | 'object' | 'light';

export type ShadowMethod = 'SM' | 'PCF' | 'PCSS' | 'VSM';
export type LightMode = 'sun' | 'spot' | 'top';

function orthoZO(out: mat4, left: number, right: number, bottom: number, top: number, near: number, far: number) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = nf;
  out[11] = 0;

  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = near * nf;
  out[15] = 1;
}

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
  private arcball!: ArcballController;
  private lastFrameTime = performance.now();
  private gridNBO!: GPUBuffer;
  private gridTBO!: GPUBuffer;
  public cameraController!: CameraController;
  private selection: Selection = 'none';
  private objectPos = vec3.fromValues(0, 0, 0); // центр объекта в мире
  private lightSelected = false;

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

  private lightSunVBO!: GPUBuffer;
  private lightSunIBO!: GPUBuffer;
  private lightSunIndexCount = 0;

  private lightSpotVBO!: GPUBuffer;
  private lightSpotIBO!: GPUBuffer;
  private lightSpotIndexCount = 0;

  private lightTopVBO!: GPUBuffer;
  private lightTopIBO!: GPUBuffer;
  private lightTopIndexCount = 0;

  private lightSphereBindGroup!: GPUBindGroup;

  private vbo!: GPUBuffer;
  private nbo!: GPUBuffer;
  private ibo!: GPUBuffer;
  private tbo!: GPUBuffer;
  private indexCount = 0;

  private dragAxisIndex: number = -1;        // 0 = X, 1 = Y, 2 = Z
  private dragAxisWorldDir = vec3.create();  // направление оси в мире
  private dragAxisScreenDir = { x: 0, y: 0 }; // направление оси на экране
  private dragStartMouseX = 0;
  private dragStartMouseY = 0;
  private objectAutoRotate = true;

  // Ориентация прожектора (spot) вокруг своей позиции
  private spotYaw = 0;    // вокруг Y
  private spotPitch = 0;  // наклон вверх/вниз

  private isRotatingLight = false;
  private rotateStartYaw = 0;
  private rotateStartPitch = 0;
  private rotateStartMouseX = 0;
  private rotateStartMouseY = 0;

  private isDraggingObject = false;
  private objectDragStartPos = vec3.create();

  private isDraggingLight = false;
  private lightDragStartHit = vec3.create();

  private uniformBuf!: GPUBuffer;
  private axisUniformBuf!: GPUBuffer;
  private bindGroup0Main!: GPUBindGroup;
  private bindGroup0Shadow!: GPUBindGroup;
  private bindGroup0VSMMoments!: GPUBindGroup;
  private bindGroup1Main!: GPUBindGroup;
  private vsmBlurBindGroup0!: GPUBindGroup; // input -> output

  private shadingBuf!: GPUBuffer;
  private shadingBindGroupMain: GPUBindGroup | null = null;
  private shadingBindGroupGrid!: GPUBindGroup;

  private objTexture!: GPUTexture;
  private objTextureView!: GPUTextureView;
  private objSampler!: GPUSampler;
  private objTexBindGroup: GPUBindGroup | null = null;

  private floorTexture!: GPUTexture;
  private floorTextureView!: GPUTextureView;
  private floorSampler!: GPUSampler;
  private floorTexBindGroup!: GPUBindGroup;

  private gridPipeline!: GPURenderPipeline;
  private gridVBO!: GPUBuffer;
  private gridBindGroup!: GPUBindGroup;
  private gridBindGroup1!: GPUBindGroup;

  private axisPipeline!: GPURenderPipeline;
  private axisVBO!: GPUBuffer;
  private axisIBO!: GPUBuffer;
  private axisIndexCount = 0;
  private axisBindGroup!: GPUBindGroup;

  private viewProj = mat4.create();
  private model = mat4.create();
  private lightDir = vec3.fromValues(5, 10, 3);
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
    vsmLightBleedReduction: 0.3,
    shadowStrength: 1.0
  };
  private lightMode: LightMode = 'sun';
  private shadowStrength = 1.0;

  setLightMode(mode: LightMode) {
    this.lightMode = mode;
  }

  setObjectAutoRotate(enabled: boolean) {
    this.objectAutoRotate = enabled;
  }

  private getLightModeIndex(): number {
    switch (this.lightMode) {
      case 'sun': return 0;
      case 'spot': return 1;
      case 'top': return 2;
    }
  }

  private getMethodIndex(): number {
    switch (this.shadowParams.method) {
      case 'SM': return 0;
      case 'PCF': return 1;
      case 'PCSS': return 2;
      case 'VSM': return 3;
    }
  }

  private initSpotOrientationFromPosition() {
    const pos = this.lightDir;
    const r = vec3.length(pos);
    if (r > 0.0001) {
      const dir = vec3.scale(vec3.create(), pos, -1 / r); // от света к центру (0,0,0)
      this.spotYaw = Math.atan2(dir[0], dir[2]);
      this.spotPitch = Math.asin(dir[1]);
    } else {
      this.spotYaw = 0;
      this.spotPitch = -Math.PI / 4.0;
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    this.gpu = await initWebGPU(this.canvas);
    this.arcball = new ArcballController(this.canvas);
    this.cameraController = new CameraController(this.canvas);

    this.createDepth();
    this.createShadowResources();
    this.createVSMResources();
    await this.createPipelines();
    this.createGeometry();
    this.createGrid();
    this.createLightSphere();
    this.createAxisGizmo();
    this.createDefaultTextures();
    this.createUniforms();
    this.recreateBindGroups();
    this.updateViewProj();
    this.updateLightViewProj();
    this.initSpotOrientationFromPosition();

    // Обработка мыши для выбора и перетаскивания
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.ctrlKey || e.shiftKey) return;
      if (this.cameraController.isLocked()) return;
      if (e.button !== 0) return;

      // Если уже выбран объект или свет — пробуем начать drag по оси
      if (this.selection === 'object' || this.selection === 'light') {
        const axisIndex = this.pickAxisHit(e.clientX, e.clientY);
        if (axisIndex !== -1) {
          this.dragAxisIndex = axisIndex;
          this.dragStartMouseX = e.clientX;
          this.dragStartMouseY = e.clientY;

          if (this.selection === 'object') {
            this.isDraggingObject = true;
            vec3.copy(this.objectDragStartPos, this.objectPos);
          } else {
            this.isDraggingLight = true;
            vec3.copy(this.lightDragStartHit, this.lightDir);
          }

          this.canvas.style.cursor = 'move';
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Если выбран свет, НЕ попали по оси и режим = SPOT → вращаем прожектор вокруг себя
        if (this.selection === 'light' && this.lightMode === 'spot') {
          this.isRotatingLight = true;
          this.rotateStartMouseX = e.clientX;
          this.rotateStartMouseY = e.clientY;
          this.rotateStartYaw = this.spotYaw;
          this.rotateStartPitch = this.spotPitch;

          this.canvas.style.cursor = 'move';
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Иначе — просто выбор объекта/света
      this.handleSelectionClick(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDraggingObject && this.dragAxisIndex !== -1) {
        const dx = e.clientX - this.dragStartMouseX;
        const dy = e.clientY - this.dragStartMouseY;

        const proj = dx * this.dragAxisScreenDir.x + dy * this.dragAxisScreenDir.y;

        const camPos = this.cameraController.getCameraPosition();
        const toObj = vec3.subtract(vec3.create(), this.objectDragStartPos, camPos);
        const dist = vec3.length(toObj) || 1;

        const worldScale = dist * 0.005;
        const t = proj * worldScale;

        const newPos = vec3.scaleAndAdd(
          vec3.create(),
          this.objectDragStartPos,
          this.dragAxisWorldDir,
          t
        );
        vec3.copy(this.objectPos, newPos);
      } else if (this.isDraggingLight && this.dragAxisIndex !== -1) {
        const dx = e.clientX - this.dragStartMouseX;
        const dy = e.clientY - this.dragStartMouseY;

        const proj = dx * this.dragAxisScreenDir.x + dy * this.dragAxisScreenDir.y;

        const camPos = this.cameraController.getCameraPosition();
        const toLight = vec3.subtract(vec3.create(), this.lightDragStartHit, camPos);
        const dist = vec3.length(toLight) || 1;

        const worldScale = dist * 0.005;
        const t = proj * worldScale;

        // новая позиция света вдоль оси
        const newPos = vec3.scaleAndAdd(
          vec3.create(),
          this.lightDragStartHit,
          this.dragAxisWorldDir,
          t
        );

        vec3.copy(this.lightDir, newPos); // lightDir теперь = позиция света
        this.updateLightViewProj();
      } else if (this.isRotatingLight) {
        const dx = e.clientX - this.rotateStartMouseX;
        const dy = e.clientY - this.rotateStartMouseY;

        const rotSpeed = 0.005;
        this.spotYaw = this.rotateStartYaw + dx * rotSpeed;

        const maxPitch = Math.PI / 2 - 0.1;
        const minPitch = -maxPitch;
        const newPitch = this.rotateStartPitch - dy * rotSpeed;
        this.spotPitch = Math.max(minPitch, Math.min(maxPitch, newPitch));
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      if (this.isDraggingObject || this.isDraggingLight || this.isRotatingLight) {
        this.isDraggingObject = false;
        this.isDraggingLight = false;
        this.isRotatingLight = false;
        this.dragAxisIndex = -1;
        this.canvas.style.cursor = 'default';
      }
    });

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

  private handleSelectionClick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;

    const invViewProj = mat4.invert(mat4.create(), this.viewProj);
    if (!invViewProj) return;

    const nearPoint = vec3.fromValues(x, y, -1);
    const farPoint = vec3.fromValues(x, y, 1);

    const worldNear = vec3.transformMat4(vec3.create(), nearPoint, invViewProj);
    const worldFar = vec3.transformMat4(vec3.create(), farPoint, invViewProj);

    const rayDir = vec3.subtract(vec3.create(), worldFar, worldNear);
    vec3.normalize(rayDir, rayDir);
    const rayOrigin = this.cameraController.getCameraPosition();

    const objectCenter = this.objectPos;
    const objectRadius = 1.5;

    const lightCenter = this.lightDir; // позиция света
    const lightRadius = 1.2;

    const tObj = this.raySphereHit(rayOrigin, rayDir, objectCenter, objectRadius);
    const tLight = this.raySphereHit(rayOrigin, rayDir, lightCenter, lightRadius);

    const hasObj = tObj < Number.POSITIVE_INFINITY;
    const hasLight = tLight < Number.POSITIVE_INFINITY;

    if (!hasObj && !hasLight) {
      this.setSelection('none');
      return;
    }

    if (hasObj && hasLight) {
      if (tLight < tObj) {
        this.setSelection('light');
      } else {
        this.setSelection('object');
      }
      return;
    }

    if (hasLight) {
      this.setSelection('light');
      return;
    }

    if (hasObj) {
      this.setSelection('object');
      return;
    }
  }

  private pickAxisHit(clientX: number, clientY: number): number {
    const axisLength = 2.2;
    const pickThresholdPx = 20; // было 10 — сделаем зону захвата шире

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // МИРОВЫЕ оси (как рисуются в шейдере gizmo)
    let originWorld: vec3;
    if (this.selection === 'light') {
      originWorld = vec3.clone(this.lightDir);
    } else {
      originWorld = vec3.clone(this.objectPos);
    }

    const axesWorld = [
      vec3.fromValues(1, 0, 0), // X
      vec3.fromValues(0, 1, 0), // Y
      vec3.fromValues(0, 0, 1), // Z
    ];

    const projectToScreen = (p: vec3): { x: number; y: number; ok: boolean } => {
      const v4 = vec4.fromValues(p[0], p[1], p[2], 1.0);
      const out = vec4.create();
      vec4.transformMat4(out, v4, this.viewProj);
      const w = out[3];
      if (w === 0) return { x: 0, y: 0, ok: false };

      const ndcX = out[0] / w;
      const ndcY = out[1] / w;

      const sx = (ndcX * 0.5 + 0.5) * rect.width;
      const sy = (1 - (ndcY * 0.5 + 0.5)) * rect.height;

      return { x: sx, y: sy, ok: true };
    };

    let bestAxis = -1;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let axisIndex = 0; axisIndex < axesWorld.length; axisIndex++) {
      const dirWorld = axesWorld[axisIndex]; // уже нормализованный

      const endWorld = vec3.scaleAndAdd(vec3.create(), originWorld, dirWorld, axisLength);

      const p0 = projectToScreen(originWorld);
      const p1 = projectToScreen(endWorld);
      if (!p0.ok || !p1.ok) continue;

      const vx = p1.x - p0.x;
      const vy = p1.y - p0.y;
      const wx = mouseX - p0.x;
      const wy = mouseY - p0.y;

      const c1 = vx * wx + vy * wy;
      let t = 0;
      if (c1 <= 0) {
        t = 0;
      } else {
        const c2 = vx * vx + vy * vy;
        if (c2 <= c1) t = 1;
        else t = c1 / c2;
      }

      const projX = p0.x + t * vx;
      const projY = p0.y + t * vy;

      const dx = mouseX - projX;
      const dy = mouseY - projY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist && dist <= pickThresholdPx) {
        bestDist = dist;
        bestAxis = axisIndex;

        // сохраняем текущие направления для drag
        vec3.copy(this.dragAxisWorldDir, dirWorld);
        const len2D = Math.sqrt(vx * vx + vy * vy) || 1;
        this.dragAxisScreenDir = { x: vx / len2D, y: vy / len2D };
      }
    }

    return bestAxis;
  }

  // Возвращает расстояние t до ближайшего пересечения луча со сферой
  // или Infinity, если пересечений нет.
  private raySphereHit(origin: vec3, dir: vec3, center: vec3, radius: number): number {
    const oc = vec3.subtract(vec3.create(), origin, center);
    const a = vec3.dot(dir, dir); // для нормализованного dir = 1
    const b = 2 * vec3.dot(oc, dir);
    const c = vec3.dot(oc, oc) - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return Number.POSITIVE_INFINITY;

    const sqrtD = Math.sqrt(discriminant);
    const t0 = (-b - sqrtD) / (2 * a);
    const t1 = (-b + sqrtD) / (2 * a);

    let t = Number.POSITIVE_INFINITY;
    if (t0 >= 0 && t0 < t) t = t0;
    if (t1 >= 0 && t1 < t) t = t1;

    return t;
  }

  private setSelection(sel: Selection) {
    if (this.selection === sel) return;
    this.selection = sel;

    this.lightSelected = (sel === 'light');  // ← флаг

    if (sel === 'object') {
      console.log('Object selected');
    } else if (sel === 'light') {
      console.log('Light selected');
    } else {
      console.log('Selection cleared');
      this.arcball.resume();
    }
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
      // position
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
      // normal
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] },
      // uv
      { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, format: 'float32x2', offset: 0 }] }
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
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] },
      { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, format: 'float32x2', offset: 0 }] }
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

    // Light visual pipeline (unlit, always on top)
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
      primitive: { topology: 'triangle-list', cullMode: 'back' }
      // depthStencil не указываем → рисуем поверх всего
    });

    // Axis gizmo pipeline (lines)
    const axisModule = device.createShaderModule({ code: axisGizmoWGSL });
    const axisBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 6 * 4, // 3 pos + 3 color
      attributes: [
        { shaderLocation: 0, format: 'float32x3', offset: 0 },
        { shaderLocation: 1, format: 'float32x3', offset: 3 * 4 }
      ]
    };

    this.axisPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: axisModule, entryPoint: 'vs_main', buffers: [axisBufferLayout] },
      fragment: {
        module: axisModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: { topology: 'line-list', cullMode: 'none' },
      // ВАЖНО: без depthStencil → gizmo рисуется поверх всего
    });
    console.log('✓ Axis gizmo pipeline created');
    console.log('✓ Light sphere pipeline created');
  }

  private createVSMResources() {
    const { device } = this.gpu;

    // Текстура моментов (RGBA16F вместо RG32F — filterable!)
    if (this.vsmMomentsTex) this.vsmMomentsTex.destroy();
    this.vsmMomentsTex = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING
    });
    this.vsmMomentsView = this.vsmMomentsTex.createView();

    // Временная текстура для blur (ping-pong)
    if (this.vsmBlurTex) this.vsmBlurTex.destroy();
    this.vsmBlurTex = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: 'rgba16float',
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
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, // front
      -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, // back
      1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, // right
      -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, // left
      -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, // top
      -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, // bottom
    ]);
    const normals = new Float32Array([
      // front
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      // back
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      // right
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      // left
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      // top
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      // bottom
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    ]);

    // Простейшая развёртка: каждый quad 0..1
    const uvs = new Float32Array([
      // front
      0, 0, 1, 0, 1, 1, 0, 1,
      // back
      0, 0, 0, 1, 1, 1, 1, 0,
      // right
      0, 0, 1, 0, 1, 1, 0, 1,
      // left
      0, 0, 1, 0, 1, 1, 0, 1,
      // top
      0, 0, 1, 0, 1, 1, 0, 1,
      // bottom
      0, 0, 0, 1, 1, 1, 1, 0,
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,    // front
      4, 5, 6, 4, 6, 7,    // back
      8, 9, 10, 8, 10, 11,    // right
      12, 13, 14, 12, 14, 15,   // left
      16, 17, 18, 16, 18, 19,   // top
      20, 21, 22, 20, 22, 23,   // bottom
    ]);
    this.indexCount = indices.length;

    this.vbo = device.createBuffer({ size: positions.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.vbo, 0, positions);

    this.nbo = device.createBuffer({ size: normals.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.nbo, 0, normals);

    this.tbo = device.createBuffer({ size: uvs.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.tbo, 0, uvs);

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

    const gridUV = new Float32Array([
      0, 0, 5, 0, 5, 5,
      0, 0, 5, 5, 0, 5
    ]);

    this.gridVBO = device.createBuffer({
      size: gridPos.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.gridVBO, 0, gridPos);

    this.gridNBO = device.createBuffer({
      size: gridNorm.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.gridNBO, 0, gridNorm);

    this.gridTBO = device.createBuffer({
      size: gridUV.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.gridTBO, 0, gridUV);
  }

  private createLightSphere() {
    const { device } = this.gpu;

    // 1) Sun: icosphere
    const sphere = SphereGenerator.createIcosphere(0.4, 1);
    this.lightSunIndexCount = sphere.indices.length;

    this.lightSunVBO = device.createBuffer({
      size: sphere.positions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightSunVBO, 0, sphere.positions.buffer);

    this.lightSunIBO = device.createBuffer({
      size: sphere.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightSunIBO, 0, sphere.indices.buffer);

    // 2) Spot: простой конус вдоль +Y (основание внизу, вершина вверху)
    const coneSegments = 16;
    const coneVerts: number[] = [];
    const coneIndices: number[] = [];

    const coneRadius = 0.5;
    const coneHeight = 1.0;
    const tipY = coneHeight * 0.5;
    const baseY = -coneHeight * 0.5;

    // Вершина конуса
    coneVerts.push(0, tipY, 0);

    // Кольцо основания
    for (let i = 0; i < coneSegments; i++) {
      const a = (i / coneSegments) * Math.PI * 2;
      const x = Math.cos(a) * coneRadius;
      const z = Math.sin(a) * coneRadius;
      coneVerts.push(x, baseY, z);
    }

    // Треугольники боковой поверхности
    for (let i = 0; i < coneSegments; i++) {
      const i0 = 0;                     // tip
      const i1 = 1 + i;                 // текущая точка основания
      const i2 = 1 + ((i + 1) % coneSegments); // следующая точка основания
      coneIndices.push(i0, i1, i2);
    }

    this.lightSpotIndexCount = coneIndices.length;

    this.lightSpotVBO = device.createBuffer({
      size: coneVerts.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightSpotVBO, 0, new Float32Array(coneVerts));

    this.lightSpotIBO = device.createBuffer({
      size: coneIndices.length * 2,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightSpotIBO, 0, new Uint16Array(coneIndices));

    // 3) Top: обратный конус вдоль -Y (остриём вниз)
    const topSegments = 16;
    const topVerts: number[] = [];
    const topIndices: number[] = [];

    const topRadius = 0.5;
    const topHeight = 1.0;
    const topTipY = -topHeight * 0.5;   // остриё внизу
    const topBaseY = topHeight * 0.5;   // основание наверху

    // Вершина (остриё) конуса сверху вниз (index 0)
    topVerts.push(0, topTipY, 0);

    // Кольцо основания (index 1..topSegments)
    for (let i = 0; i < topSegments; i++) {
      const a = (i / topSegments) * Math.PI * 2;
      const x = Math.cos(a) * topRadius;
      const z = Math.sin(a) * topRadius;
      topVerts.push(x, topBaseY, z);
    }

    // Центр основания (index = 1 + topSegments)
    const baseCenterIndex = 1 + topSegments;
    topVerts.push(0, topBaseY, 0);

    // Боковая поверхность
    for (let i = 0; i < topSegments; i++) {
      const i0 = 0;                           // tip
      const i1 = 1 + i;                       // текущая точка основания
      const i2 = 1 + ((i + 1) % topSegments); // следующая точка основания
      topIndices.push(i0, i1, i2);
    }

    // Донышко (основание) — веер из треугольников
    for (let i = 0; i < topSegments; i++) {
      const i1 = 1 + i;
      const i2 = 1 + ((i + 1) % topSegments);
      // порядок вершин выбираем так, чтобы нормаль смотрела наружу (вверх)
      topIndices.push(baseCenterIndex, i2, i1);
    }

    this.lightTopIndexCount = topIndices.length;

    this.lightTopVBO = device.createBuffer({
      size: topVerts.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightTopVBO, 0, new Float32Array(topVerts));

    this.lightTopIBO = device.createBuffer({
      size: topIndices.length * 2,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightTopIBO, 0, new Uint16Array(topIndices));

    console.log('✓ Light meshes (sun/spot/top) created');
  }

  private createAxisGizmo() {
    const { device } = this.gpu;
    const size = 2.2; // длина осей, чуть больше
    const verts: number[] = [];
    const idx: number[] = [];
    let base = 0;

    const pushLine = (
      x1: number, y1: number, z1: number,
      x2: number, y2: number, z2: number,
      r: number, g: number, b: number
    ) => {
      verts.push(
        x1, y1, z1, r, g, b,
        x2, y2, z2, r, g, b
      );
      idx.push(base, base + 1);
      base += 2;
    };

    // Одна линия на каждую ось

    // X axis (красный)
    pushLine(0, 0, 0, size, 0, 0, 1, 0, 0);

    // Y axis (зелёный)
    pushLine(0, 0, 0, 0, size, 0, 0, 1, 0);

    // Z axis (синий)
    pushLine(0, 0, 0, 0, 0, size, 0, 0, 1);

    // ОКРУЖНОСТЬ в плоскости XZ (белая) — "ось" вращения вокруг Y
    const circleRadius = size * 0.9;
    const circleSegments = 32;

    for (let i = 0; i < circleSegments; i++) {
      const a0 = (i / circleSegments) * Math.PI * 2;
      const a1 = ((i + 1) / circleSegments) * Math.PI * 2;

      const x0 = Math.cos(a0) * circleRadius;
      const z0 = Math.sin(a0) * circleRadius;
      const x1 = Math.cos(a1) * circleRadius;
      const z1 = Math.sin(a1) * circleRadius;

      pushLine(x0, 0, z0, x1, 0, z1, 1, 1, 1);
    }

    const vertices = new Float32Array(verts);
    const indices = new Uint16Array(idx);

    this.axisIndexCount = indices.length;

    this.axisVBO = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.axisVBO, 0, vertices);

    this.axisIBO = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.axisIBO, 0, indices);

    console.log('✓ Axis gizmo geometry created');
  }

  private createUniforms() {
    const { device } = this.gpu;
    const uniformSize = 16 * 4 * 3 + 4 * 4 * 2;

    this.uniformBuf = device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.axisUniformBuf = device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.shadingBuf = device.createBuffer({
      size: 32, // два vec4<f32> = 8 float32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
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

    this.gridBindGroup = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }]
    });

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

    // Axis gizmo bind group
    this.axisBindGroup = device.createBindGroup({
      layout: this.axisPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.axisUniformBuf } }]
    });

    // Shading params for main object (group 3) — для текущего метода
    this.shadingBindGroupMain = device.createBindGroup({
      layout: currentPipeline.getBindGroupLayout(3),
      entries: [{ binding: 0, resource: { buffer: this.shadingBuf } }]
    });

    // Shading params for grid (group 3)
    this.shadingBindGroupGrid = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(3),
      entries: [{ binding: 0, resource: { buffer: this.shadingBuf } }]
    });

    // Object texture bind group (group = 2) — теперь есть во всех методах
    this.objTexBindGroup = device.createBindGroup({
      layout: currentPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: this.objTextureView },
        { binding: 1, resource: this.objSampler }
      ]
    });

    // Floor texture bind group (grid pipeline group = 2)
    this.floorTexBindGroup = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: this.floorTextureView },
        { binding: 1, resource: this.floorSampler }
      ]
    });
  }

  private createDefaultTextures() {
    const { device } = this.gpu;

    const createSolidTex = (r: number, g: number, b: number): [GPUTexture, GPUTextureView] => {
      const tex = device.createTexture({
        size: [1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      const data = new Uint8Array([r, g, b, 255]);
      device.queue.writeTexture(
        { texture: tex },
        data,
        { bytesPerRow: 4 },
        { width: 1, height: 1 }
      );
      return [tex, tex.createView()];
    };

    [this.objTexture, this.objTextureView] = createSolidTex(200, 200, 200);
    [this.floorTexture, this.floorTextureView] = createSolidTex(120, 120, 120);

    this.objSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat'
    });

    this.floorSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat'
    });
  }

  private updateViewProj() {
    const aspect = this.canvas.width / this.canvas.height;
    const proj = mat4.create();
    mat4.perspective(proj, (60 * Math.PI) / 180, aspect, 0.1, 100.0);

    const view = this.cameraController.getViewMatrix();
    mat4.multiply(this.viewProj, proj, view);
  }

  private updateLightViewProj() {
    // Позиция света в мире
    const lightPos = vec3.clone(this.lightDir);

    // Нормаль направления света для up-вектора
    const lightDirNorm = vec3.normalize(vec3.create(), lightPos);

    let up = vec3.fromValues(0, 1, 0);
    const dotUp = Math.abs(vec3.dot(lightDirNorm, [0, 1, 0]));
    if (dotUp > 0.99) {
      up = vec3.fromValues(0, 0, 1);
    }

    const lightView = mat4.create();
    mat4.lookAt(lightView, lightPos, [0, 0, 0], up);

    const lightProj = mat4.create();
    const size = 8;
    const near = 1.0;
    const far = 20.0;
    orthoZO(lightProj, -size, size, -size, size, near, far);

    mat4.multiply(this.lightViewProj, lightProj, lightView);
  }

  async loadObjectTexture(file: File) {
    const { device } = this.gpu;
    const bitmap = await createImageBitmap(file);

    if (this.objTexture) this.objTexture.destroy();

    this.objTexture = device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: this.objTexture },
      { width: bitmap.width, height: bitmap.height }
    );

    this.objTextureView = this.objTexture.createView();
    this.recreateBindGroups();
  }

  async loadFloorTexture(file: File) {
    const { device } = this.gpu;
    const bitmap = await createImageBitmap(file);

    if (this.floorTexture) this.floorTexture.destroy();

    this.floorTexture = device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: this.floorTexture },
      { width: bitmap.width, height: bitmap.height }
    );

    this.floorTextureView = this.floorTexture.createView();
    this.recreateBindGroups();
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
    if (this.vsmMomentsTex) this.vsmMomentsTex.destroy();
    if (this.vsmBlurTex) this.vsmBlurTex.destroy();
    if (this.vbo) this.vbo.destroy();
    if (this.nbo) this.nbo.destroy();
    if (this.ibo) this.ibo.destroy();
    if (this.uniformBuf) this.uniformBuf.destroy();
    if (this.axisVBO) this.axisVBO.destroy();
    if (this.axisIBO) this.axisIBO.destroy();
    if (this.axisUniformBuf) this.axisUniformBuf.destroy();
    if (this.shadingBuf) this.shadingBuf.destroy();
    if (this.tbo) this.tbo.destroy();
    if (this.gridTBO) this.gridTBO.destroy();
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

    // Определяем индекс режима света
    const lightModeIndex = this.getLightModeIndex();
    const methodIndex = this.getMethodIndex();

    // Обновляем буфер настроек шейдинга:
    // [ shadowStrength, lightModeIndex, spotYaw, spotPitch, methodIndex, 0,0,0 ]
    const shadingData = new Float32Array(8);
    shadingData[0] = this.shadowStrength;     // 0..2
    shadingData[1] = lightModeIndex;          // 0,1,2  (sun/spot/top)
    shadingData[2] = this.spotYaw;            // ориентация прожектора
    shadingData[3] = this.spotPitch;
    shadingData[4] = methodIndex;             // 0=SM,1=PCF,2=PCSS,3=VSM
    shadingData[5] = 0;
    shadingData[6] = 0;
    shadingData[7] = 0;
    device.queue.writeBuffer(this.shadingBuf, 0, shadingData.buffer);

    this.cameraController.update(deltaTime);
    this.updateViewProj();

    // Если тащим объект или авто‑вращение выключено — не крутим его
    const arcballDelta =
      this.isDraggingObject || !this.objectAutoRotate ? 0 : deltaTime;
    const rotation = this.arcball.update(arcballDelta);

    // Собираем модельную матрицу = Translation(objectPos) * Rotation
    const model = mat4.create();
    mat4.fromTranslation(model, this.objectPos);
    mat4.multiply(model, model, rotation);
    this.model = model;

    const lightPos = this.lightDir;

    const tmp = new Float32Array(16 * 3 + 4 * 2);
    tmp.set(this.model, 0);
    tmp.set(this.viewProj, 16);
    tmp.set(this.lightViewProj, 32);
    tmp.set([
      lightPos[0],
      lightPos[1],
      lightPos[2],
      this.lightSelected ? 1 : 0
    ], 48);

    if (this.shadowParams.method === 'PCSS') {
      // PCSS оставляем как было
      tmp.set([
        this.shadowParams.bias,
        this.shadowParams.pcssLightSize,
        this.shadowParams.pcssBlockerSearchSamples,
        this.shadowParams.shadowMapSize
      ], 52);
    } else if (this.shadowParams.method === 'VSM') {
      // VSM тоже без изменений
      tmp.set([
        this.shadowParams.vsmMinVariance,
        this.shadowParams.vsmLightBleedReduction,
        0,
        0
      ], 52);
    } else if (this.shadowParams.method === 'SM') {
      // Для SM: [bias, lightModeIndex, spotYaw, spotPitch]
      tmp.set([
        this.shadowParams.bias,
        lightModeIndex,
        this.spotYaw,
        this.spotPitch
      ], 52);
    } else {
      // PCF — оставляем старую упаковку (радиус, сэмплы, размер карты)
      tmp.set([
        this.shadowParams.bias,
        this.shadowParams.pcfRadius,
        this.shadowParams.pcfSamples,
        this.shadowParams.shadowMapSize
      ], 52);
    }

    device.queue.writeBuffer(this.uniformBuf, 0, tmp.buffer);
    // Обновляем uniform для gizmo (оси объекта или света)
    if (this.selection !== 'none') {
      const axisModel = mat4.create();

      if (this.selection === 'object') {
        mat4.copy(axisModel, this.model);
      } else {
        // Gizmo в центре света
        mat4.fromTranslation(axisModel, this.lightDir);
      }

      const tmpAxis = new Float32Array(16 * 3 + 4 * 2);
      tmpAxis.set(axisModel, 0);
      tmpAxis.set(this.viewProj, 16);
      tmpAxis.set(this.lightViewProj, 32);
      tmpAxis.set([
        lightPos[0],
        lightPos[1],
        lightPos[2],
        this.lightSelected ? 1 : 0
      ], 48);
      tmpAxis.set(tmp.subarray(52, 56), 52);

      device.queue.writeBuffer(this.axisUniformBuf, 0, tmpAxis.buffer);
    }

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
    mainPass.setVertexBuffer(0, this.vbo);
    mainPass.setVertexBuffer(1, this.nbo);
    mainPass.setVertexBuffer(2, this.tbo);
    mainPass.setBindGroup(0, this.bindGroup0Main);
    mainPass.setBindGroup(1, this.bindGroup1Main);
    mainPass.setBindGroup(2, this.objTexBindGroup);

    if (this.shadingBindGroupMain) {
      mainPass.setBindGroup(3, this.shadingBindGroupMain);
    }

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
    gridPass.setVertexBuffer(2, this.gridTBO);
    gridPass.setBindGroup(0, this.gridBindGroup);
    gridPass.setBindGroup(1, this.gridBindGroup1);
    gridPass.setBindGroup(2, this.floorTexBindGroup);
    gridPass.setBindGroup(3, this.shadingBindGroupGrid);
    gridPass.draw(6);
    gridPass.end();

    // Light sphere pass (рендерим последним поверх всего)
    // Light visual pass (sun / spot / top)
    const spherePass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'load',
        storeOp: 'store'
      }]
    });

    spherePass.setPipeline(this.lightSpherePipeline);
    spherePass.setBindGroup(0, this.lightSphereBindGroup);

    let vbo: GPUBuffer;
    let ibo: GPUBuffer;
    let count = 0;

    if (this.lightMode === 'sun') {
      vbo = this.lightSunVBO;
      ibo = this.lightSunIBO;
      count = this.lightSunIndexCount;
    } else if (this.lightMode === 'spot') {
      vbo = this.lightSpotVBO;
      ibo = this.lightSpotIBO;
      count = this.lightSpotIndexCount;
    } else {
      vbo = this.lightTopVBO;
      ibo = this.lightTopIBO;
      count = this.lightTopIndexCount;
    }

    spherePass.setVertexBuffer(0, vbo);
    spherePass.setIndexBuffer(ibo, 'uint16');
    spherePass.drawIndexed(count);
    spherePass.end();

    // Axis gizmo pass (если выбран объект ИЛИ свет)
    if (this.selection === 'object' || this.selection === 'light') {
      const axisPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          loadOp: 'load',
          storeOp: 'store'
        }],
      });
      axisPass.setPipeline(this.axisPipeline);
      axisPass.setVertexBuffer(0, this.axisVBO);
      axisPass.setIndexBuffer(this.axisIBO, 'uint16');
      axisPass.setBindGroup(0, this.axisBindGroup);
      axisPass.drawIndexed(this.axisIndexCount);
      axisPass.end();
    }

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
    shadowStrength?: number;
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
      vsmLightBleedReduction: params.vsmLightBleedReduction ?? this.shadowParams.vsmLightBleedReduction,
      shadowStrength: params.shadowStrength ?? this.shadowParams.shadowStrength
    };
    this.shadowStrength = this.shadowParams.shadowStrength ?? 1.0;

    // Пересоздаём ресурсы если изменился размер
    if (sizeChanged) {
      this.shadowSize = params.shadowMapSize;
      this.createShadowResources();
      this.createVSMResources();
    }

    // Пересоздаём bind groups при смене метода или размера
    if (methodChanged || sizeChanged) {
      this.recreateBindGroups();
      console.log(`Switched to ${params.method}, bind groups recreated`);
    }
  }

  resetScene() {
    // Сбрасываем камеру
    this.cameraController.reset();
    this.updateViewProj();

    // Сбрасываем свет
    this.lightDir = vec3.fromValues(5, 10, 3);
    this.updateLightViewProj();
    this.initSpotOrientationFromPosition();

    // Сбрасываем тип света и силу теней
    this.lightMode = 'sun';
    this.shadowParams.shadowStrength = 1.0;
    this.shadowStrength = 1.0;

    // Сбрасываем вращение объекта
    this.arcball.reset();

    // Сбрасываем позицию объекта и выделение
    vec3.set(this.objectPos, 0, 0, 0);
    this.selection = 'none';
    this.isDraggingObject = false;
    this.isDraggingLight = false;
    this.dragAxisIndex = -1;
    this.canvas.style.cursor = 'default';

    console.log('✓ Scene reset to defaults (camera/light/object/light/shadows)');
  }

  resetModel() {
    // Возвращаем дефолтную геометрию (куб)
    this.createGeometry();
    console.log('✓ Model reset to default cube');
  }

  async loadModel(file: File) {
    const loader = new ModelLoader();

    try {
      const url = URL.createObjectURL(file);
      const model = await loader.loadOBJ(url);
      URL.revokeObjectURL(url);

      const { device } = this.gpu;

      // Обновляем буферы
      if (this.vbo) this.vbo.destroy();
      if (this.nbo) this.nbo.destroy();
      if (this.ibo) this.ibo.destroy();

      this.vbo = device.createBuffer({
        size: model.positions.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(this.vbo, 0, model.positions.buffer);

      this.nbo = device.createBuffer({
        size: model.normals.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(this.nbo, 0, model.normals.buffer);

      this.ibo = device.createBuffer({
        size: model.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(this.ibo, 0, model.indices.buffer);

      this.indexCount = model.indices.length;

      console.log(`✓ Loaded OBJ: ${model.positions.length / 3} vertices, ${model.indices.length / 3} triangles`);
    } catch (e) {
      console.error('Failed to load OBJ:', e);
      alert(`Ошибка загрузки модели: ${e}`);
    }
  }

}
