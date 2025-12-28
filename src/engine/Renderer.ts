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
import lightBeamWGSL from '../shaders/light_beam.wgsl?raw';
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

type LightDef = {
  pos: vec3;
  type: LightMode;
  yaw: number;
  pitch: number;
  intensity: number;
  color: vec3;
  castShadows: boolean;
};

type SceneObject = {
  id: number;
  pos: vec3;
  moveSpeed: number;
  color: vec3;
  castShadows: boolean;
  receiveShadows: boolean;
  meshId: number;
  specular: number;
  shininess: number;
};

type MeshDef = {
  id: number;
  name: string;
  vbo: GPUBuffer;
  nbo: GPUBuffer;
  tbo: GPUBuffer;
  ibo: GPUBuffer;
  indexCount: number;
};

type LightDTO = {
  pos: [number, number, number];
  type: LightMode;
  yaw: number;
  pitch: number;
  intensity: number;
  color: [number, number, number];
  castShadows: boolean;
};

type ObjectDTO = {
  pos: [number, number, number];
  moveSpeed: number;
  color: [number, number, number];
  castShadows: boolean;
  receiveShadows: boolean;
  meshId: number;
  specular: number;
  shininess: number;
};

type ShadowParamsDTO = {
  shadowMapSize: number;
  bias: number;
  method: ShadowMethod;
  pcfRadius: number;
  pcfSamples: number;
  pcssLightSize: number;
  pcssBlockerSearchSamples: number;
  vsmMinVariance: number;
  vsmLightBleedReduction: number;
  shadowStrength: number;
};

type SceneDTO = {
  lights: LightDTO[];
  objects: ObjectDTO[];
  floorColor: [number, number, number];
  wallColor: [number, number, number];
  showFloor: boolean;
  showWalls: boolean;
  shadowParams: ShadowParamsDTO;
};

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

  // Объекты сцены
  private objects: SceneObject[] = [];
  private activeObjectIndex = 0;

  private shadowSize = 2048;
  private shadowTex!: GPUTexture;
  private shadowView!: GPUTextureView;
  private shadowTex1!: GPUTexture;
  private shadowView1!: GPUTextureView;
  private shadowSampler!: GPUSampler;       // общий sampler_comparison
  private shadowSamplerLinear!: GPUSampler; // для PCSS

  // VSM текстуры
  private vsmMomentsTex!: GPUTexture;
  private vsmMomentsView!: GPUTextureView;
  private vsmBlurTex!: GPUTexture;
  private vsmBlurView!: GPUTextureView;
  private vsmSampler!: GPUSampler;

  private lightSunVBO!: GPUBuffer;
  private lightSunIBO!: GPUBuffer;

  private lightSpotVBO!: GPUBuffer;
  private lightSpotIBO!: GPUBuffer;

  private lightTopVBO!: GPUBuffer;
  private lightTopIBO!: GPUBuffer;

  private lightBeamPipeline!: GPURenderPipeline;
  private lightBeamVBO!: GPUBuffer;
  private lightBeamIBO!: GPUBuffer;
  private lightBeamIndexCount = 0;

  private lightBeamBindGroup!: GPUBindGroup;

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

  private gridParamsBuf!: GPUBuffer;
  private shadingBuf!: GPUBuffer;
  private shadingBindGroupMain: GPUBindGroup | null = null;
  private shadingBindGroupGrid!: GPUBindGroup;
  private lightsBuf!: GPUBuffer;
  private objectParamsBuf!: GPUBuffer;
  private shadowMatsBuf!: GPUBuffer;

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

  private wallVBO!: GPUBuffer;
  private wallNBO!: GPUBuffer;
  private wallTBO!: GPUBuffer;

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

  private showFloor = true;
  private showWalls = true;
  private floorColor = vec3.fromValues(0.15, 0.16, 0.18);
  private wallColor = vec3.fromValues(0.10, 0.11, 0.13);
  private objectMoveSpeed = 1.0;
  private lightIntensity = 1.0;
  private showLightBeam = true;

  private lights: LightDef[] = [];
  private activeLightIndex = 0;

  private meshes: MeshDef[] = [];
  private defaultMeshId = 0; // индекс «куба» по умолчанию

  // Метаданные для UI
  getLightsMeta() {
    return {
      count: this.lights.length,
      activeIndex: this.activeLightIndex
    };
  }

  // Установить активный источник
  setActiveLight(index: number) {
    if (this.lights.length === 0) return;
    const clamped = Math.max(0, Math.min(index, this.lights.length - 1));
    this.activeLightIndex = clamped;

    const l = this.lights[clamped];
    // Синхронизируем глобальные поля под активный свет
    this.lightMode = l.type;
    this.lightIntensity = l.intensity;
    vec3.copy(this.lightDir, l.pos);
    this.spotYaw = l.yaw;
    this.spotPitch = l.pitch;
    this.updateLightViewProj();
  }

  // Добавить новый источник (возвращает его индекс)
  addLight(def?: Partial<LightDef>): number {
    if (this.lights.length >= 4) {
      console.warn('Максимум 4 источника света');
      return this.lights.length - 1;
    }

    const basePos = def?.pos
      ? vec3.clone(def.pos)
      : vec3.fromValues(this.objectPos[0] + 4, 6, this.objectPos[2] + 2);

    const light: LightDef = {
      pos: basePos,
      type: def?.type ?? 'spot',
      yaw: def?.yaw ?? 0.8,
      pitch: def?.pitch ?? -0.6,
      intensity: def?.intensity ?? 1.0,
      color: def?.color ?? vec3.fromValues(1.0, 1.0, 1.0),
      castShadows: def?.castShadows ?? false
    };

    this.lights.push(light);
    const idx = this.lights.length - 1;
    this.setActiveLight(idx);
    return idx;
  }

  // Удалить источник (кроме того, чтобы не остаться без единого)
  removeLight(index: number) {
    if (this.lights.length <= 1) {
      console.warn('Должен быть хотя бы один источник света');
      return;
    }

    if (index < 0 || index >= this.lights.length) return;

    this.lights.splice(index, 1);

    if (this.activeLightIndex >= this.lights.length) {
      this.activeLightIndex = this.lights.length - 1;
    }
    // Обновляем старые поля под новый активный
    const l = this.lights[this.activeLightIndex];
    this.lightMode = l.type;
    this.lightIntensity = l.intensity;
    vec3.copy(this.lightDir, l.pos);
    this.spotYaw = l.yaw;
    this.spotPitch = l.pitch;
    this.updateLightViewProj();
  }

  // Метаданные объектов для UI
  getObjectsMeta() {
    return {
      count: this.objects.length,
      activeIndex: this.activeObjectIndex
    };
  }

  exportScene(): SceneDTO {
    const lights: LightDTO[] = this.lights.map((l) => ({
      pos: [l.pos[0], l.pos[1], l.pos[2]],
      type: l.type,
      yaw: l.yaw,
      pitch: l.pitch,
      intensity: l.intensity,
      color: [l.color[0], l.color[1], l.color[2]],
      castShadows: l.castShadows
    }));

    const objects: ObjectDTO[] = this.objects.map((o) => ({
      pos: [o.pos[0], o.pos[1], o.pos[2]],
      moveSpeed: o.moveSpeed,
      color: [o.color[0], o.color[1], o.color[2]],
      castShadows: o.castShadows,
      receiveShadows: o.receiveShadows,
      meshId: o.meshId ?? this.defaultMeshId,
      specular: o.specular,
      shininess: o.shininess
    }));

    return {
      lights,
      objects,
      floorColor: [this.floorColor[0], this.floorColor[1], this.floorColor[2]],
      wallColor: [this.wallColor[0], this.wallColor[1], this.wallColor[2]],
      showFloor: this.showFloor,
      showWalls: this.showWalls,
      shadowParams: { ...this.shadowParams }
    };
  }

  importScene(scene: SceneDTO) {
    // Свет
    this.lights = scene.lights.map((ld) => ({
      pos: vec3.fromValues(ld.pos[0], ld.pos[1], ld.pos[2]),
      type: ld.type,
      yaw: ld.yaw,
      pitch: ld.pitch,
      intensity: ld.intensity,
      color: vec3.fromValues(
        ld.color?.[0] ?? 1.0,
        ld.color?.[1] ?? 1.0,
        ld.color?.[2] ?? 1.0
      ),
      castShadows: ld.castShadows ?? false
    }));

    if (this.lights.length === 0) {
      this.initDefaultLights();
    }
    this.activeLightIndex = 0;

    const main = this.lights[0];
    this.lightMode = main.type;
    this.lightIntensity = main.intensity;
    vec3.copy(this.lightDir, main.pos);
    this.spotYaw = main.yaw;
    this.spotPitch = main.pitch;
    this.updateLightViewProj();

    // Объекты
    this.objects = scene.objects.map((od, idx) => ({
      id: idx,
      pos: vec3.fromValues(od.pos[0], od.pos[1], od.pos[2]),
      moveSpeed: od.moveSpeed,
      color: vec3.fromValues(
        od.color?.[0] ?? 1.0,
        od.color?.[1] ?? 1.0,
        od.color?.[2] ?? 1.0
      ),
      castShadows: od.castShadows ?? true,
      receiveShadows: od.receiveShadows ?? true,
      meshId: od.meshId ?? this.defaultMeshId,
      specular: od.specular ?? 0.5,
      shininess: od.shininess ?? 32.0
    }));

    if (this.objects.length === 0) {
      this.initDefaultObjects();
    }
    this.activeObjectIndex = 0;
    vec3.copy(this.objectPos, this.objects[0].pos);

    // Пол и стены
    vec3.set(this.floorColor, scene.floorColor[0], scene.floorColor[1], scene.floorColor[2]);
    vec3.set(this.wallColor, scene.wallColor[0], scene.wallColor[1], scene.wallColor[2]);
    this.showFloor = scene.showFloor;
    this.showWalls = scene.showWalls;

    // Параметры теней
    this.updateShadowParams(scene.shadowParams);

    console.log('✓ Scene imported from JSON');
  }

  setActiveObject(index: number) {
    if (this.objects.length === 0) return;
    const clamped = Math.max(0, Math.min(index, this.objects.length - 1));
    this.activeObjectIndex = clamped;
    const obj = this.objects[clamped];
    vec3.copy(this.objectPos, obj.pos);
  }

  addObject(def?: Partial<SceneObject>): number {
    const id = this.objects.length ? this.objects[this.objects.length - 1].id + 1 : 0;
    const basePos = def?.pos
      ? vec3.clone(def.pos)
      : vec3.fromValues(this.objectPos[0] + 2, this.objectPos[1], this.objectPos[2] + 2);

    const obj: SceneObject = {
      id,
      pos: basePos,
      moveSpeed: def?.moveSpeed ?? this.objectMoveSpeed,
      color: def?.color ?? vec3.fromValues(1.0, 1.0, 1.0),
      castShadows: def?.castShadows ?? true,
      receiveShadows: def?.receiveShadows ?? true,
      meshId: def?.meshId ?? this.defaultMeshId,
      specular: def?.specular ?? 0.5,
      shininess: def?.shininess ?? 32.0
    };

    this.objects.push(obj);
    this.activeObjectIndex = this.objects.length - 1;
    vec3.copy(this.objectPos, obj.pos);
    return this.activeObjectIndex;
  }

  removeObject(index: number) {
    if (this.objects.length <= 1) {
      console.warn('Должен быть хотя бы один объект');
      return;
    }
    if (index < 0 || index >= this.objects.length) return;

    this.objects.splice(index, 1);
    if (this.activeObjectIndex >= this.objects.length) {
      this.activeObjectIndex = this.objects.length - 1;
    }
    const obj = this.objects[this.activeObjectIndex];
    vec3.copy(this.objectPos, obj.pos);
  }

  getActiveObjectInfo() {
    const obj = this.objects[this.activeObjectIndex];
    if (!obj) {
      return {
        color: [1, 1, 1] as [number, number, number],
        castShadows: true,
        receiveShadows: true,
        meshId: this.defaultMeshId,
        specular: 0.5,
        shininess: 32.0
      };
    }
    return {
      color: [obj.color[0], obj.color[1], obj.color[2]] as [number, number, number],
      castShadows: obj.castShadows,
      receiveShadows: obj.receiveShadows,
      meshId: obj.meshId,
      specular: obj.specular,
      shininess: obj.shininess
    };
  }

  setActiveObjectSpecular(value: number) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.specular = value;
    }
  }

  setActiveObjectShininess(value: number) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.shininess = value;
    }
  }

  setActiveObjectColor(rgb: [number, number, number]) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      vec3.set(obj.color, rgb[0], rgb[1], rgb[2]);
    }
  }

  setActiveObjectCastShadows(value: boolean) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.castShadows = value;
    }
  }

  setActiveObjectReceiveShadows(value: boolean) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.receiveShadows = value;
    }
  }

  setShowLightBeam(value: boolean) {
    this.showLightBeam = value;
  }

  setObjectMoveSpeed(speed: number) {
    this.objectMoveSpeed = speed;
  }

  setLightMode(mode: LightMode) {
    this.lightMode = mode;
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.type = mode;
    }
  }

  setLightIntensity(value: number) {
    this.lightIntensity = value;
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.intensity = value;
    }
  }

  setObjectAutoRotate(enabled: boolean) {
    this.objectAutoRotate = enabled;
  }

  setFloorVisible(visible: boolean) {
    this.showFloor = visible;
  }

  setWallsVisible(visible: boolean) {
    this.showWalls = visible;
  }

  setFloorColor(rgb: [number, number, number]) {
    vec3.set(this.floorColor, rgb[0], rgb[1], rgb[2]);
  }

  setWallColor(rgb: [number, number, number]) {
    vec3.set(this.wallColor, rgb[0], rgb[1], rgb[2]);
  }

  private getShadowCasterIndex(): number {
    for (let i = 0; i < this.lights.length; i++) {
      if (this.lights[i].castShadows) return i;
    }
    return -1;
  }

  private getShadowCasters(max: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.lights.length; i++) {
      if (this.lights[i].castShadows) {
        result.push(i);
        if (result.length >= max) break;
      }
    }
    return result;
  }

  private initDefaultLights() {
    this.lights = [];
    const main: LightDef = {
      pos: vec3.clone(this.lightDir),
      type: this.lightMode,
      yaw: this.spotYaw,
      pitch: this.spotPitch,
      intensity: this.lightIntensity,
      color: vec3.fromValues(1.0, 1.0, 1.0),
      castShadows: true
    };
    this.lights.push(main);

    const second: LightDef = {
      pos: vec3.fromValues(-6, 8, -4),
      type: 'spot',
      yaw: 0.8,
      pitch: -0.6,
      intensity: 0.7,
      color: vec3.fromValues(1.0, 0.9, 0.7),
      castShadows: false
    };
    this.lights.push(second);

    this.activeLightIndex = 0;
  }

  private initDefaultObjects() {
    this.objects = [
      {
        id: 0,
        pos: vec3.fromValues(0, 0, 0),
        moveSpeed: 1.0,
        color: vec3.fromValues(1.0, 1.0, 1.0),
        castShadows: true,
        receiveShadows: true,
        meshId: this.defaultMeshId,
        specular: 0.5,
        shininess: 32.0
      }
    ];
    this.activeObjectIndex = 0;
    vec3.copy(this.objectPos, this.objects[0].pos);
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
    this.cameraController = new CameraController(this.canvas);

    this.createDepth();
    this.createShadowResources();
    this.createVSMResources();
    await this.createPipelines();
    this.createGeometry();
    this.createGrid();
    this.createWalls();
    this.createLightSphere();
    this.createAxisGizmo();
    this.createDefaultTextures();
    this.createUniforms();
    this.recreateBindGroups();
    this.updateViewProj();
    this.updateLightViewProj();
    this.initSpotOrientationFromPosition();
    this.initDefaultObjects();
    this.initDefaultLights();

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
          if (this.arcball) this.arcball.enabled = false;

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

          if (this.arcball) this.arcball.enabled = false;

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

        const worldScale = dist * 0.005 * this.objectMoveSpeed;
        const t = proj * worldScale;

        const newPos = vec3.scaleAndAdd(
          vec3.create(),
          this.objectDragStartPos,
          this.dragAxisWorldDir,
          t
        );
        vec3.copy(this.objectPos, newPos);

        const obj = this.objects[this.activeObjectIndex];
        if (obj) {
          vec3.copy(obj.pos, newPos);
        }
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

        const l = this.lights[this.activeLightIndex];
        if (l) {
          vec3.copy(l.pos, newPos);
        }

        // Тени всегда от активного света → всегда обновляем shadow-камеру
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
        const l = this.lights[this.activeLightIndex];
        if (l) {
          l.yaw = this.spotYaw;
          l.pitch = this.spotPitch;
        }

        // Активный свет — теневой → обновляем shadow-камеру
        this.updateLightViewProj();
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      if (this.isDraggingObject || this.isDraggingLight || this.isRotatingLight) {
        this.isDraggingObject = false;
        this.isDraggingLight = false;
        this.isRotatingLight = false;
        this.dragAxisIndex = -1;
        this.canvas.style.cursor = 'default';

        if (this.arcball) this.arcball.enabled = true;
      }
    });

    window.addEventListener('resize', () => {
      this.gpu.configure();
      this.createDepth();
      this.recreateBindGroups();
      this.updateViewProj();
    });

    this.arcball = new ArcballController(this.canvas);
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

    // Поиск ближайшего объекта
    const objectRadius = 1.8;
    let bestObjT = Number.POSITIVE_INFINITY;
    let bestObjIndex = -1;

    for (let i = 0; i < this.objects.length; i++) {
      const center = this.objects[i].pos;
      const t = this.raySphereHit(rayOrigin, rayDir, center, objectRadius);
      if (t < bestObjT) {
        bestObjT = t;
        bestObjIndex = i;
      }
    }

    // Поиск ближайшего источника света
    const lightRadius = 0.9;
    let bestLightT = Number.POSITIVE_INFINITY;
    let bestLightIndex = -1;

    for (let i = 0; i < this.lights.length; i++) {
      const center = this.lights[i].pos;
      const t = this.raySphereHit(rayOrigin, rayDir, center, lightRadius);
      if (t < bestLightT) {
        bestLightT = t;
        bestLightIndex = i;
      }
    }

    const hasObj = bestObjIndex !== -1;
    const hasLight = bestLightIndex !== -1;

    if (!hasObj && !hasLight) {
      this.setSelection('none');
      return;
    }

    if (hasObj && hasLight) {
      // Берём то, что ближе по лучу
      if (bestLightT < bestObjT) {
        this.setActiveLight(bestLightIndex);
        this.setSelection('light');
      } else {
        this.activeObjectIndex = bestObjIndex;
        const obj = this.objects[this.activeObjectIndex];
        vec3.copy(this.objectPos, obj.pos);
        this.setSelection('object');
      }
      return;
    }

    if (hasLight) {
      this.setActiveLight(bestLightIndex);
      this.setSelection('light');
      return;
    }

    if (hasObj) {
      this.activeObjectIndex = bestObjIndex;
      const obj = this.objects[this.activeObjectIndex];
      vec3.copy(this.objectPos, obj.pos);
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

    this.lightSelected = (sel === 'light');

    if (sel === 'object') {
      console.log('Object selected');
      if (this.arcball) this.arcball.enabled = true; // можно вращать мышью
    } else if (sel === 'light') {
      console.log('Light selected');
    } else {
      console.log('Selection cleared');
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
    if (this.shadowTex1) this.shadowTex1.destroy();

    this.shadowTex = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    this.shadowView = this.shadowTex.createView();

    // Вторая карта для второго теневого источника (SM)
    this.shadowTex1 = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    this.shadowView1 = this.shadowTex1.createView();

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

    const posLayout: GPUVertexBufferLayout = {
      arrayStride: 3 * 4,
      attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }]
    };

    const mainVertexBuffers: GPUVertexBufferLayout[] = [
      // position
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
      // normal
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] },
      // uv
      { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, format: 'float32x2', offset: 0 }] }
    ];

    const gridVertexBuffers: GPUVertexBufferLayout[] = [
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
      { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, format: 'float32x3', offset: 0 }] },
      { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, format: 'float32x2', offset: 0 }] }
    ];

    this.createShadowPipeline(device, posLayout);
    this.createMainPipelines(device, format, mainVertexBuffers);
    this.createVSMPipelines(device, format, mainVertexBuffers, posLayout);
    this.createGridPipeline(device, format, gridVertexBuffers);
    this.createLightAndAxisPipelines(device, format);
  }

  private createShadowPipeline(device: GPUDevice, posLayout: GPUVertexBufferLayout) {
    const depthModule = device.createShaderModule({ code: depthWGSL });
    this.shadowPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: depthModule, entryPoint: 'vs_main', buffers: [posLayout] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ Shadow pipeline created');
  }

  private createMainPipelines(
    device: GPUDevice,
    format: GPUTextureFormat,
    vertexBuffers: GPUVertexBufferLayout[]
  ) {
    // SM
    const smModule = device.createShaderModule({ code: basicWGSL });
    this.pipelineSM = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: smModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: smModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ SM pipeline created');

    // PCF
    const pcfModule = device.createShaderModule({ code: pcfWGSL });
    this.pipelinePCF = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: pcfModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: pcfModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ PCF pipeline created');

    // PCSS
    const pcssModule = device.createShaderModule({ code: pcssWGSL });
    this.pipelinePCSS = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: pcssModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: pcssModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ PCSS pipeline created');
  }

  private createVSMPipelines(
    device: GPUDevice,
    format: GPUTextureFormat,
    vertexBuffers: GPUVertexBufferLayout[],
    posLayout: GPUVertexBufferLayout
  ) {
    // VSM moments (запись моментов в rgba16float)
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

    // VSM shading
    const vsmModule = device.createShaderModule({ code: vsmWGSL });
    this.pipelineVSM = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: vsmModule, entryPoint: 'vs_main', buffers: vertexBuffers },
      fragment: { module: vsmModule, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
    });
    console.log('✓ VSM pipeline created');

    // Blur (compute)
    const blurModule = device.createShaderModule({ code: vsmBlurWGSL });
    this.blurHorizontalPipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: blurModule, entryPoint: 'cs_horizontal' }
    });
    console.log('✓ Blur pipeline created');
  }

  private createGridPipeline(
    device: GPUDevice,
    format: GPUTextureFormat,
    gridBuffers: GPUVertexBufferLayout[]
  ) {
    const gridSolidModule = device.createShaderModule({ code: gridSolidWGSL });
    this.gridPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: gridSolidModule, entryPoint: 'vs_main', buffers: gridBuffers },
      fragment: {
        module: gridSolidModule,
        entryPoint: 'fs_main',
        targets: [{
          format,
          blend: {
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
  }

  private createLightAndAxisPipelines(device: GPUDevice, format: GPUTextureFormat) {
    // Axis gizmo (оси/окружность)
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
      primitive: { topology: 'line-list', cullMode: 'none' }
      // без depthStencil → gizmo поверх всего
    });
    console.log('✓ Axis gizmo pipeline created');

    // Пайплайн для луча (линия от источника к полу)
    const beamModule = device.createShaderModule({ code: lightBeamWGSL });
    const beamLayout: GPUVertexBufferLayout = {
      arrayStride: 3 * 4,
      attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }]
    };
    this.lightBeamPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: beamModule, entryPoint: 'vs_main', buffers: [beamLayout] },
      fragment: {
        module: beamModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: { topology: 'line-list', cullMode: 'none' }
      // без depthStencil → рисуем поверх сцены
    });
    console.log('✓ Light beam pipeline created');
  }

  // Загружает изображение из File и создаёт из него GPU-текстуру RGBA8
  private async createTextureFromImageFile(file: File): Promise<{ texture: GPUTexture; view: GPUTextureView }> {
    const { device } = this.gpu;

    // 1) Декодируем файл в <img>
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);

    const width = img.width;
    const height = img.height;

    // 2) Рисуем на canvas и читаем пиксели
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Не удалось создать 2D контекст для загрузки текстуры');
    }

    // Можно сделать flipY при необходимости: ctx.scale(1, -1); ctx.translate(0, -height);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const src = imageData.data; // Uint8ClampedArray RGBA

    // 3) Подготавливаем выровненный по 256 байтам буфер
    const bytesPerPixel = 4;
    const unpaddedRowSize = width * bytesPerPixel;
    const paddedRowSize = Math.ceil(unpaddedRowSize / 256) * 256;
    const dst = new Uint8Array(paddedRowSize * height);

    for (let y = 0; y < height; y++) {
      const srcOffset = y * unpaddedRowSize;
      const dstOffset = y * paddedRowSize;
      dst.set(src.subarray(srcOffset, srcOffset + unpaddedRowSize), dstOffset);
    }

    // 4) Создаём текстуру и пишем данные
    const texture = device.createTexture({
      size: [width, height],
      format: 'rgba8unorm', // простой UNORM, без sRGB, чтобы исключить артефакты
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    device.queue.writeTexture(
      { texture },
      dst,
      { bytesPerRow: paddedRowSize },
      { width, height }
    );

    const view = texture.createView();
    return { texture, view };
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

    this.meshes = [];
    const mesh: MeshDef = {
      id: 0,
      name: 'Cube',
      vbo: this.vbo,
      nbo: this.nbo,
      tbo: this.tbo,
      ibo: this.ibo,
      indexCount: this.indexCount
    };
    this.meshes.push(mesh);
    this.defaultMeshId = 0;
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

  private createWalls() {
    const { device } = this.gpu;

    const yBottom = -2.5;
    const yTop = 7.5;
    const xMin = -10, xMax = 10;
    const zMin = -10, zMax = 10;

    // Задняя стена (z = -10), смотрит внутрь (нормаль +Z)
    const backPos = [
      xMin, yBottom, zMin,
      xMax, yBottom, zMin,
      xMax, yTop, zMin,
      xMin, yBottom, zMin,
      xMax, yTop, zMin,
      xMin, yTop, zMin,
    ];
    const backNorm = [
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, 1
    ];
    const backUV = [
      0, 0, 5, 0, 5, 5,
      0, 0, 5, 5, 0, 5
    ];

    // Правая стена (x = 10), смотрит внутрь (нормаль -X)
    const rightPos = [
      xMax, yBottom, zMin,
      xMax, yBottom, zMax,
      xMax, yTop, zMax,
      xMax, yBottom, zMin,
      xMax, yTop, zMax,
      xMax, yTop, zMin,
    ];
    const rightNorm = [
      -1, 0, 0, -1, 0, 0, -1, 0, 0,
      -1, 0, 0, -1, 0, 0, -1, 0, 0
    ];
    const rightUV = [
      0, 0, 5, 0, 5, 5,
      0, 0, 5, 5, 0, 5
    ];

    const pos = new Float32Array([...backPos, ...rightPos]);
    const norm = new Float32Array([...backNorm, ...rightNorm]);
    const uv = new Float32Array([...backUV, ...rightUV]);

    this.wallVBO = device.createBuffer({
      size: pos.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.wallVBO, 0, pos);

    this.wallNBO = device.createBuffer({
      size: norm.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.wallNBO, 0, norm);

    this.wallTBO = device.createBuffer({
      size: uv.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.wallTBO, 0, uv);
  }

  private createLightSphere() {
    const { device } = this.gpu;

    // 1) Sun: icosphere
    const sphere = SphereGenerator.createIcosphere(0.4, 1);

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

    // Геометрия луча: одна линия (2 вершины), позиции обновляем каждый кадр
    const beamVerts = new Float32Array(2 * 3); // [0,0,0], [0,0,0] — заполним позже
    const beamIdx = new Uint16Array([0, 1]);

    this.lightBeamVBO = device.createBuffer({
      size: beamVerts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightBeamVBO, 0, beamVerts);

    this.lightBeamIBO = device.createBuffer({
      size: beamIdx.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this.lightBeamIBO, 0, beamIdx);

    this.lightBeamIndexCount = 2;

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
    pushLine(0, 0, 0, 0, -size, 0, 0, 1, 0);

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
    const uniformSize = 16 * 4 * 3 + 4 * 4 * 3;

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

    this.gridParamsBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.objectParamsBuf = device.createBuffer({
      size: 32, // два vec4<f32> = 8 float32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.shadowMatsBuf = device.createBuffer({
      // ShadowMatrices = (count + pad3 + 2*16) float32 = 36 * 4 = 144,
      // но layout требует minBindingSize = 160 → берём с запасом
      size: 160,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.lightsBuf = device.createBuffer({
      // count(4) + pad(12) + 4 * sizeof(Light)
      // Light = vec3 + f + f + f + f + vec3 = 16 * 4 bytes = 64
      // Итого 16*4 + 4*64 = 64 + 256 = 320 → округлим до 352 для выравнивания
      size: 352,
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
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.objectParamsBuf } },
        { binding: 2, resource: { buffer: this.shadowMatsBuf } }
      ]
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
    } else if (this.shadowParams.method === 'SM') {
      // SM: две карты теней и два сэмплера (один и тот же)
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler },
          { binding: 2, resource: this.shadowView1 },
          { binding: 3, resource: this.shadowSampler }
        ]
      });
    } else {
      // PCF: одна карта
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
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.gridParamsBuf } },
        { binding: 2, resource: { buffer: this.shadowMatsBuf } }
      ]
    });

    this.gridBindGroup1 = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: this.shadowView },
        { binding: 1, resource: this.shadowSampler }
      ]
    });

    // Light beam bind group (отдельный layout, но те же Uniforms)
    this.lightBeamBindGroup = device.createBindGroup({
      layout: this.lightBeamPipeline.getBindGroupLayout(0),
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
      entries: [
        { binding: 0, resource: { buffer: this.shadingBuf } },
        { binding: 1, resource: { buffer: this.lightsBuf } }
      ]
    });

    // Shading params for grid (group 3)
    this.shadingBindGroupGrid = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(3),
      entries: [
        { binding: 0, resource: { buffer: this.shadingBuf } },
        { binding: 1, resource: { buffer: this.lightsBuf } }
      ]
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
        format: 'rgba8unorm',      // БЫЛО 'rgba8unorm-srgb'
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
    const main = this.lights[this.activeLightIndex];
    const pos = main ? main.pos : this.lightDir;

    const lightPos = vec3.clone(pos);

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

    // lightDir = позиция активного источника (для оси/луча и т.п.)
    vec3.copy(this.lightDir, lightPos);
  }

  private computeLightViewProjFor(lightIndex: number): mat4 {
    const res = mat4.create();
    const l = this.lights[lightIndex];
    if (!l) {
      mat4.identity(res);
      return res;
    }
    const lightPos = vec3.clone(l.pos);
    const lightDirNorm = vec3.normalize(vec3.create(), lightPos);

    let up = vec3.fromValues(0, 1, 0);
    const dotUp = Math.abs(vec3.dot(lightDirNorm, [0, 1, 0]));
    if (dotUp > 0.99) {
      up = vec3.fromValues(0, 0, 1);
    }

    const view = mat4.create();
    const proj = mat4.create();
    mat4.lookAt(view, lightPos, [0, 0, 0], up);

    const size = 8;
    const near = 1.0;
    const far = 20.0;
    orthoZO(proj, -size, size, -size, size, near, far);

    mat4.multiply(res, proj, view);
    return res;
  }

  private updateLightBeamGeometry() {
    const { device } = this.gpu;
    if (!this.lightBeamVBO) return;

    const active = this.lights[this.activeLightIndex];
    if (!active) {
      const zero = new Float32Array(6);
      device.queue.writeBuffer(this.lightBeamVBO, 0, zero);
      return;
    }

    const lightPos = active.pos;
    const floorY = -2.5;

    const dir = vec3.create();

    if (active.type === 'spot') {
      vec3.set(
        dir,
        Math.cos(active.pitch) * Math.sin(active.yaw),
        Math.sin(active.pitch),
        Math.cos(active.pitch) * Math.cos(active.yaw)
      );
    } else if (active.type === 'top') {
      vec3.set(dir, 0, -1, 0);
    } else { // sun
      vec3.set(dir, -lightPos[0], -lightPos[1], -lightPos[2]);
    }

    if (vec3.length(dir) < 1e-3) {
      const zero = new Float32Array(6);
      device.queue.writeBuffer(this.lightBeamVBO, 0, zero);
      return;
    }

    vec3.normalize(dir, dir);

    const dy = dir[1];
    const endWorld = vec3.create();

    if (Math.abs(dy) < 1e-4) {
      vec3.scaleAndAdd(endWorld, lightPos, dir, 3.0);
    } else {
      const t = (floorY - lightPos[1]) / dy;
      if (t <= 0.0) {
        vec3.scaleAndAdd(endWorld, lightPos, dir, 3.0);
      } else {
        vec3.scaleAndAdd(endWorld, lightPos, dir, t);
      }
    }

    const verts = new Float32Array([
      lightPos[0], lightPos[1], lightPos[2],
      endWorld[0], endWorld[1], endWorld[2]
    ]);
    device.queue.writeBuffer(this.lightBeamVBO, 0, verts);
  }

  // Экранная позиция источника света (для оверлей-иконки)
  getLightScreenPosition(): { x: number; y: number; visible: boolean } {
    const rect = this.canvas.getBoundingClientRect();
    const active = this.lights[this.activeLightIndex];
    if (!active) return { x: 0, y: 0, visible: false };

    const lightPos = active.pos;

    // Мировая позиция → clip space
    const p = vec4.fromValues(lightPos[0], lightPos[1], lightPos[2], 1.0);
    const clip = vec4.create();
    vec4.transformMat4(clip, p, this.viewProj);
    const w = clip[3];

    if (w <= 0.0) {
      return { x: 0, y: 0, visible: false };
    }

    const ndcX = clip[0] / w;
    const ndcY = clip[1] / w;

    const sx = (ndcX * 0.5 + 0.5) * rect.width;
    const sy = (1 - (ndcY * 0.5 + 0.5)) * rect.height;

    const visible =
      ndcX >= -1.0 && ndcX <= 1.0 &&
      ndcY >= -1.0 && ndcY <= 1.0;

    return { x: sx, y: sy, visible };
  }

  getAllLightsScreenPositions(): { x: number; y: number; visible: boolean; mode: LightMode; active: boolean }[] {
    const rect = this.canvas.getBoundingClientRect();
    const result: { x: number; y: number; visible: boolean; mode: LightMode; active: boolean }[] = [];

    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      if (!l) continue;

      const lightPos = l.pos;
      const p = vec4.fromValues(lightPos[0], lightPos[1], lightPos[2], 1.0);
      const clip = vec4.create();
      vec4.transformMat4(clip, p, this.viewProj);
      const w = clip[3];

      if (w <= 0.0) {
        result.push({ x: 0, y: 0, visible: false, mode: l.type, active: i === this.activeLightIndex });
        continue;
      }

      const ndcX = clip[0] / w;
      const ndcY = clip[1] / w;

      const sx = (ndcX * 0.5 + 0.5) * rect.width;
      const sy = (1 - (ndcY * 0.5 + 0.5)) * rect.height;

      const visible =
        ndcX >= -1.0 && ndcX <= 1.0 &&
        ndcY >= -1.0 && ndcY <= 1.0;

      result.push({
        x: sx,
        y: sy,
        visible,
        mode: l.type,
        active: i === this.activeLightIndex
      });
    }

    return result;
  }

  getMeshesMeta() {
    return this.meshes.map(m => ({ id: m.id, name: m.name }));
  }

  setActiveObjectMesh(meshId: number) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.meshId = meshId;
    }
  }

  setLightColor(rgb: [number, number, number]) {
    const l = this.lights[this.activeLightIndex];
    if (l) {
      vec3.set(l.color, rgb[0], rgb[1], rgb[2]);
    }
  }

  getLightInfo() {
    const active = this.lights[this.activeLightIndex];
    if (!active) {
      return {
        mode: this.lightMode,
        intensity: this.lightIntensity,
        position: vec3.clone(this.lightDir),
        color: [1, 1, 1] as [number, number, number],
        castShadows: true
      };
    }
    return {
      mode: active.type,
      intensity: active.intensity,
      position: vec3.clone(active.pos),
      color: [active.color[0], active.color[1], active.color[2]] as [number, number, number],
      castShadows: active.castShadows
    };
  }

  setActiveLightCastShadows(value: boolean) {
    const l = this.lights[this.activeLightIndex];
    if (!l) return;

    l.castShadows = value;

    // Пересчёт теневой камеры: по-прежнему привязываем её к первому кастеру
    this.updateLightViewProj();
  }

  async loadObjectTexture(file: File) {
    if (this.objTexture) this.objTexture.destroy();

    const { texture, view } = await this.createTextureFromImageFile(file);
    this.objTexture = texture;
    this.objTextureView = view;

    this.recreateBindGroups();
  }

  async loadFloorTexture(file: File) {
    if (this.floorTexture) this.floorTexture.destroy();

    const { texture, view } = await this.createTextureFromImageFile(file);
    this.floorTexture = texture;
    this.floorTextureView = view;

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
    if (this.shadowTex1) this.shadowTex1.destroy();
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
    if (this.gridParamsBuf) this.gridParamsBuf.destroy();
    if (this.wallVBO) this.wallVBO.destroy();
    if (this.wallNBO) this.wallNBO.destroy();
    if (this.wallTBO) this.wallTBO.destroy();
    if (this.lightBeamVBO) this.lightBeamVBO.destroy();
    if (this.lightBeamIBO) this.lightBeamIBO.destroy();
    if (this.lightsBuf) this.lightsBuf.destroy();
    if (this.objectParamsBuf) this.objectParamsBuf.destroy();
    if (this.shadowMatsBuf) this.shadowMatsBuf.destroy();

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

    // [ strength, lightMode, yaw, pitch, methodIndex, intensity, 0,0 ]
    const shadingData = new Float32Array(8);
    shadingData[0] = this.shadowStrength;
    shadingData[1] = lightModeIndex;
    shadingData[2] = this.spotYaw;
    shadingData[3] = this.spotPitch;
    shadingData[4] = methodIndex;
    shadingData[5] = this.lightIntensity;

    const casters = this.getShadowCasters(2);
    const caster0 = casters.length > 0 ? casters[0] : -1;
    const caster1 = casters.length > 1 ? casters[1] : -1;

    shadingData[6] = caster0; // shadowCaster0
    shadingData[7] = caster1; // shadowCaster1

    device.queue.writeBuffer(this.shadingBuf, 0, shadingData.buffer);

    // Матрицы для двух кастеров (SM и ShadowMatrices будут использовать одно и то же)
    let lightViewProj0 = mat4.create();
    let lightViewProj1 = mat4.create();

    if (caster0 >= 0) {
      lightViewProj0 = this.computeLightViewProjFor(caster0);
      // Обновляем this.lightViewProj, чтобы остальной код (grid, PCF и т.п.) видел тот же источник
      mat4.copy(this.lightViewProj, lightViewProj0);
    }

    if (caster1 >= 0) {
      lightViewProj1 = this.computeLightViewProjFor(caster1);
    }

    // ShadowMatrices: до двух теневых источников
    const shadowMats = new Float32Array(40);

    if (caster0 >= 0) {
      shadowMats[0] = 1.0; // минимум один кастер
      shadowMats.set(lightViewProj0, 4); // mats[0]
    } else {
      shadowMats[0] = 0.0;
    }

    if (caster1 >= 0 && caster0 >= 0) {
      shadowMats.set(lightViewProj1, 4 + 16); // mats[1]
      shadowMats[0] = 2.0;
    }

    device.queue.writeBuffer(this.shadowMatsBuf, 0, shadowMats.buffer);


    const gridParams = new Float32Array(8);
    gridParams[0] = this.floorColor[0];
    gridParams[1] = this.floorColor[1];
    gridParams[2] = this.floorColor[2];
    gridParams[4] = this.wallColor[0];
    gridParams[5] = this.wallColor[1];
    gridParams[6] = this.wallColor[2];
    device.queue.writeBuffer(this.gridParamsBuf, 0, gridParams.buffer);

    const maxLights = 4;
    const lightStructFloats = 12; // Light = 48 байт = 12 float32
    // LightsData: count (1 float) + скрытый паддинг + _pad0(vec3) + ещё паддинг → lights начинаются с float[8]
    const lightsData = new Float32Array(8 + maxLights * lightStructFloats);

    const count = Math.min(this.lights.length || 1, maxLights);
    lightsData[0] = count;
    // lightsData[1..7] оставляем нулями (паддинг + _pad0)

    for (let i = 0; i < count; i++) {
      const l = this.lights[i] ?? {
        pos: this.lightDir,
        type: this.lightMode,
        yaw: this.spotYaw,
        pitch: this.spotPitch,
        intensity: this.lightIntensity,
        color: vec3.fromValues(1, 1, 1),
        castShadows: false
      };

      const base = 8 + i * lightStructFloats;

      // Соответствие полям struct Light:
      // pos: vec3<f32>, lightType: f32, yaw: f32, pitch: f32, intensity: f32, color: vec3<f32>
      lightsData[base + 0] = l.pos[0];
      lightsData[base + 1] = l.pos[1];
      lightsData[base + 2] = l.pos[2];
      lightsData[base + 3] =
        l.type === 'sun' ? 0 :
        l.type === 'spot' ? 1 : 2;
      lightsData[base + 4] = l.yaw;
      lightsData[base + 5] = l.pitch;
      lightsData[base + 6] = l.intensity;
      // base+7 — паддинг внутри Light, оставляем нулём
      lightsData[base + 8] = l.color[0];
      lightsData[base + 9] = l.color[1];
      lightsData[base + 10] = l.color[2];
      // base+11 — паддинг, ноль
    }

    device.queue.writeBuffer(this.lightsBuf, 0, lightsData.buffer);

    const activeObj = this.objects[this.activeObjectIndex];
    if (activeObj) {
      vec3.copy(this.objectPos, activeObj.pos);
    }
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

    const camPos = this.cameraController.getCameraPosition();

    const tmp = new Float32Array(16 * 3 + 4 * 3);
    tmp.set(this.model, 0);
    tmp.set(this.viewProj, 16);
    tmp.set(this.lightViewProj, 32);
    tmp.set([
      lightPos[0],
      lightPos[1],
      lightPos[2],
      this.lightSelected ? 1 : 0
    ], 48);
    tmp.set([
      camPos[0],
      camPos[1],
      camPos[2],
      1.0
    ], 52);

    if (this.shadowParams.method === 'PCSS') {
      tmp.set([
        this.shadowParams.bias,
        this.shadowParams.pcssLightSize,
        this.shadowParams.pcssBlockerSearchSamples,
        this.shadowParams.shadowMapSize
      ], 56);
    } else if (this.shadowParams.method === 'VSM') {
      tmp.set([
        this.shadowParams.vsmMinVariance,
        this.shadowParams.vsmLightBleedReduction,
        0,
        0
      ], 56);
    } else if (this.shadowParams.method === 'SM') {
      tmp.set([
        this.shadowParams.bias,
        lightModeIndex,
        this.spotYaw,
        this.spotPitch
      ], 56);
    } else {
      tmp.set([
        this.shadowParams.bias,
        this.shadowParams.pcfRadius,
        this.shadowParams.pcfSamples,
        this.shadowParams.shadowMapSize
      ], 56);
    }

    device.queue.writeBuffer(this.uniformBuf, 0, tmp.buffer);

    // Обновляем uniform для gizmo (оси объекта или света)
    if (this.selection !== 'none') {
      const axisModel = mat4.create();

      if (this.selection === 'object') {
        mat4.copy(axisModel, this.model);
      } else {
        mat4.fromTranslation(axisModel, this.lightDir);
      }

      const tmpAxis = new Float32Array(16 * 3 + 4 * 3);
      tmpAxis.set(axisModel, 0);
      tmpAxis.set(this.viewProj, 16);
      tmpAxis.set(this.lightViewProj, 32);
      tmpAxis.set([
        lightPos[0],
        lightPos[1],
        lightPos[2],
        this.lightSelected ? 1 : 0
      ], 48);
      tmpAxis.set([
        camPos[0],
        camPos[1],
        camPos[2],
        1.0
      ], 52);
      tmpAxis.set(tmp.subarray(56, 60), 56);

      device.queue.writeBuffer(this.axisUniformBuf, 0, tmpAxis.buffer);
    }
    // Обновляем геометрию луча света
    this.updateLightBeamGeometry();

    const encoder = device.createCommandEncoder();

    // Shadow pass
    if (this.shadowParams.method === 'VSM') {
      const vsmPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.vsmMomentsView,
          clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
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
      vsmPass.setBindGroup(0, this.bindGroup0VSMMoments);

      for (const obj of this.objects) {
        if (!obj.castShadows) continue;

        const mesh = this.meshes.find(m => m.id === obj.meshId) ?? this.meshes[0];
        vsmPass.setVertexBuffer(0, mesh.vbo);
        vsmPass.setIndexBuffer(mesh.ibo, 'uint16');

        const modelMat = mat4.create();
        mat4.fromTranslation(modelMat, obj.pos);
        mat4.multiply(modelMat, modelMat, rotation);
        device.queue.writeBuffer(this.uniformBuf, 0, modelMat as any);

        vsmPass.drawIndexed(mesh.indexCount);
      }

      vsmPass.end();

      const blurH = encoder.beginComputePass();
      blurH.setPipeline(this.blurHorizontalPipeline);
      blurH.setBindGroup(0, this.vsmBlurBindGroup0);
      const workgroupsX = Math.ceil(this.shadowSize / 8);
      const workgroupsY = Math.ceil(this.shadowSize / 8);
      blurH.dispatchWorkgroups(workgroupsX, workgroupsY);
      blurH.end();
    } else {
      // Не VSM: SM / PCF / PCSS
      if (this.shadowParams.method === 'SM') {
        // PASS 0: caster0 -> shadowView
        if (caster0 >= 0) {
          const shadowPass0 = encoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
              view: this.shadowView,
              depthClearValue: 1.0,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
            }
          });
          shadowPass0.setPipeline(this.shadowPipeline);
          shadowPass0.setBindGroup(0, this.bindGroup0Shadow);

          for (const obj of this.objects) {
            if (!obj.castShadows) continue;

            const mesh = this.meshes.find(m => m.id === obj.meshId) ?? this.meshes[0];
            shadowPass0.setVertexBuffer(0, mesh.vbo);
            shadowPass0.setIndexBuffer(mesh.ibo, 'uint16');

            const modelMat = mat4.create();
            mat4.fromTranslation(modelMat, obj.pos);
            mat4.multiply(modelMat, modelMat, rotation);

            const ub = new Float32Array(16 * 3 + 4 * 3);
            ub.set(modelMat, 0);
            ub.set(this.viewProj, 16);
            ub.set(lightViewProj0, 32);
            device.queue.writeBuffer(this.uniformBuf, 0, ub.buffer);

            shadowPass0.drawIndexed(mesh.indexCount);
          }

          shadowPass0.end();
        }

        // PASS 1: caster1 -> shadowView1
        if (caster1 >= 0) {
          const shadowPass1 = encoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
              view: this.shadowView1,
              depthClearValue: 1.0,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
            }
          });
          shadowPass1.setPipeline(this.shadowPipeline);
          shadowPass1.setBindGroup(0, this.bindGroup0Shadow);

          for (const obj of this.objects) {
            if (!obj.castShadows) continue;

            const mesh = this.meshes.find(m => m.id === obj.meshId) ?? this.meshes[0];
            shadowPass1.setVertexBuffer(0, mesh.vbo);
            shadowPass1.setIndexBuffer(mesh.ibo, 'uint16');

            const modelMat = mat4.create();
            mat4.fromTranslation(modelMat, obj.pos);
            mat4.multiply(modelMat, modelMat, rotation);

            const ub = new Float32Array(16 * 3 + 4 * 3);
            ub.set(modelMat, 0);
            ub.set(this.viewProj, 16);
            ub.set(lightViewProj1, 32);
            device.queue.writeBuffer(this.uniformBuf, 0, ub.buffer);

            shadowPass1.drawIndexed(mesh.indexCount);
          }

          shadowPass1.end();
        }
      } else {
        // PCF / PCSS: один shadow-pass в shadowView (как и раньше)
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
        shadowPass.setBindGroup(0, this.bindGroup0Shadow);

        for (const obj of this.objects) {
          if (!obj.castShadows) continue;

          const mesh = this.meshes.find(m => m.id === obj.meshId) ?? this.meshes[0];
          shadowPass.setVertexBuffer(0, mesh.vbo);
          shadowPass.setIndexBuffer(mesh.ibo, 'uint16');

          const modelMat = mat4.create();
          mat4.fromTranslation(modelMat, obj.pos);
          mat4.multiply(modelMat, modelMat, rotation);
          device.queue.writeBuffer(this.uniformBuf, 0, modelMat as any);

          shadowPass.drawIndexed(mesh.indexCount);
        }
        shadowPass.end();
      }
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
    mainPass.setBindGroup(0, this.bindGroup0Main);
    mainPass.setBindGroup(1, this.bindGroup1Main);
    mainPass.setBindGroup(2, this.objTexBindGroup);

    if (this.shadingBindGroupMain) {
      mainPass.setBindGroup(3, this.shadingBindGroupMain);
    }

    for (const obj of this.objects) {
      const mesh = this.meshes.find(m => m.id === obj.meshId) ?? this.meshes[0];
      mainPass.setVertexBuffer(0, mesh.vbo);
      mainPass.setVertexBuffer(1, mesh.nbo);
      mainPass.setVertexBuffer(2, mesh.tbo);
      mainPass.setIndexBuffer(mesh.ibo, 'uint16');

      const modelMat = mat4.create();
      mat4.fromTranslation(modelMat, obj.pos);
      mat4.multiply(modelMat, modelMat, rotation);
      device.queue.writeBuffer(this.uniformBuf, 0, modelMat as any);

      const objParams = new Float32Array(8);
      objParams[0] = obj.color[0];
      objParams[1] = obj.color[1];
      objParams[2] = obj.color[2];
      objParams[3] = obj.receiveShadows ? 1.0 : 0.0;
      objParams[4] = obj.specular;
      objParams[5] = obj.shininess;
      objParams[6] = 0.0;
      objParams[7] = 0.0;
      device.queue.writeBuffer(this.objectParamsBuf, 0, objParams);

      mainPass.drawIndexed(mesh.indexCount);
    }
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
    gridPass.setBindGroup(0, this.gridBindGroup);
    gridPass.setBindGroup(1, this.gridBindGroup1);
    gridPass.setBindGroup(2, this.floorTexBindGroup);
    gridPass.setBindGroup(3, this.shadingBindGroupGrid);

    if (this.showFloor) {
      gridPass.setVertexBuffer(0, this.gridVBO);
      gridPass.setVertexBuffer(1, this.gridNBO);
      gridPass.setVertexBuffer(2, this.gridTBO);
      gridPass.draw(6);
    }

    if (this.showWalls) {
      gridPass.setVertexBuffer(0, this.wallVBO);
      gridPass.setVertexBuffer(1, this.wallNBO);
      gridPass.setVertexBuffer(2, this.wallTBO);
      gridPass.draw(12); // 2 стены по 6 вершин каждая
    }

    gridPass.end();

    // Light pass: только луч (модель источника заменена 2D-иконкой поверх canvas)
    const lightPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'load',
        storeOp: 'store'
      }]
    });

    if (this.showLightBeam) {
      lightPass.setPipeline(this.lightBeamPipeline);
      lightPass.setBindGroup(0, this.lightBeamBindGroup);
      lightPass.setVertexBuffer(0, this.lightBeamVBO);
      lightPass.setIndexBuffer(this.lightBeamIBO, 'uint16');
      lightPass.drawIndexed(this.lightBeamIndexCount);
    }

    lightPass.end();

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

    // Сбрасываем объекты
    this.initDefaultObjects();

    // Сбрасываем свет
    this.lightDir = vec3.fromValues(5, 10, 3);
    this.lightMode = 'sun';
    this.lightIntensity = 1.0;
    this.initSpotOrientationFromPosition();
    this.initDefaultLights();
    this.updateLightViewProj();

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

    // Все объекты снова используют куб
    for (const obj of this.objects) {
      obj.meshId = this.defaultMeshId;
    }

    console.log('✓ Model reset to default cube');
  }

  async loadModel(file: File) {
    const loader = new ModelLoader();

    try {
      const url = URL.createObjectURL(file);
      const model = await loader.loadOBJ(url);
      URL.revokeObjectURL(url);

      const { device } = this.gpu;

      // Создаём отдельные буферы для нового меша
      const vbo = device.createBuffer({
        size: model.positions.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(vbo, 0, model.positions.buffer);

      const nbo = device.createBuffer({
        size: model.normals.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(nbo, 0, model.normals.buffer);

      const ibo = device.createBuffer({
        size: model.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(ibo, 0, model.indices.buffer);

      const indexCount = model.indices.length;

      // Новый id меша
      const newId = this.meshes.length
        ? this.meshes[this.meshes.length - 1].id + 1
        : 0;

      const mesh: MeshDef = {
        id: newId,
        name: file.name,
        vbo,
        nbo,
        // Временно используем UV-буфер куба для всех мешей
        tbo: this.tbo,
        ibo,
        indexCount
      };

      this.meshes.push(mesh);

      // Назначаем новую модель активному объекту
      const obj = this.objects[this.activeObjectIndex];
      if (obj) {
        obj.meshId = newId;
      }

      console.log(
        `✓ Loaded OBJ mesh #${newId}: ${model.positions.length / 3} vertices, ${indexCount / 3} triangles`
      );
    } catch (e) {
      console.error('Failed to load OBJ:', e);
      alert(`Ошибка загрузки модели: ${e}`);
    }
  }
}
