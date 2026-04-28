import { mat4, vec3, vec4 } from "gl-matrix";
import { initWebGPU } from "../gpu/initWebGPU";
import { ArcballController } from "./ArcballController";
import { ModelLoader } from "../loaders/ModelLoader";
import { CameraController } from "./CameraController";
import {
  createAxisGizmoGeometry,
  createCubeGeometry,
  createGridGeometry,
  createLightMeshesGeometry,
  createWallsGeometry,
} from "./geometryData";
import { orthoZO } from "./math";
import { createRendererPipelines } from "./pipelines";
import {
  createBufferFromData,
  createDefaultTextureResources,
  createDepthResource,
  createShadowResources as createShadowResourceSet,
  createUniformBuffers,
  createVSMResources as createVSMResourceSet,
} from "./resources";
import {
  createDefaultLights,
  createDefaultObjects,
  createLight,
  createSceneDTO,
  createSceneObject,
  lightsFromDTO,
  objectsFromDTO,
} from "./scene";
import { projectToScreen, raySphereHit } from "./interaction";
import { createTextureFromImageFile } from "./textureUtils";
import type {
  GPUCtx,
  LightDef,
  LightMode,
  MeshDef,
  SceneDTO,
  SceneObject,
  Selection,
  ShadowMethod,
} from "./types";

export type { LightMode, ShadowMethod } from "./types";

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
  private selection: Selection = "none";
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
  private shadowSampler!: GPUSampler; // общий sampler_comparison
  private shadowSamplerLinear!: GPUSampler; // для PCSS

  // VSM текстуры
  private vsmMomentsTex!: GPUTexture;
  private vsmMomentsView!: GPUTextureView;
  private vsmBlurTex!: GPUTexture;
  private vsmBlurView!: GPUTextureView;
  private vsmSampler!: GPUSampler;

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

  private dragAxisIndex: number = -1; // 0 = X, 1 = Y, 2 = Z
  private dragAxisWorldDir = vec3.create(); // направление оси в мире
  private dragAxisScreenDir = { x: 0, y: 0 }; // направление оси на экране
  private dragStartMouseX = 0;
  private dragStartMouseY = 0;
  private objectAutoRotate = true;

  // Ориентация прожектора (spot) вокруг своей позиции
  private spotYaw = 0; // вокруг Y
  private spotPitch = 0; // наклон вверх/вниз

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
    method: "SM" as ShadowMethod,
    pcfRadius: 2.0,
    pcfSamples: 16,
    pcssLightSize: 0.05,
    pcssBlockerSearchSamples: 16,
    vsmMinVariance: 0.00001,
    vsmLightBleedReduction: 0.3,
    shadowStrength: 1.0,
  };
  private lightMode: LightMode = "sun";
  private shadowStrength = 1.0;

  private showFloor = true;
  private showWalls = true;
  private floorColor = vec3.fromValues(0.15, 0.16, 0.18);
  private wallColor = vec3.fromValues(0.1, 0.11, 0.13);
  private objectMoveSpeed = 1.0;
  private lightIntensity = 1.0;
  private showLightBeam = true;

  private lights: LightDef[] = [];
  private activeLightIndex = 0;

  private meshes: MeshDef[] = [];
  private meshById = new Map<number, MeshDef>();
  private defaultMeshId = 0; // индекс «куба» по умолчанию

  private lightBeamDirty = true;

  private tempShadingData = new Float32Array(8);
  private tempShadowMats = new Float32Array(40);
  private tempGridParams = new Float32Array(8);
  private tempLightsData = new Float32Array(8 + 4 * 12);
  private tempAxisUniform = new Float32Array(16 * 3 + 4 * 3);
  private tempObjParams = new Float32Array(8);
  private tempLightUniform = new Float32Array(4);
  private tempCameraUniform = new Float32Array(4);
  private tempShadowParamsUniform = new Float32Array(4);
  private tempLightBeamVertices = new Float32Array(6);
  private tempZeroBeamVertices = new Float32Array(6);
  private lastShadingData = new Float32Array(8);
  private lastShadowMats = new Float32Array(40);
  private lastGridParams = new Float32Array(8);
  private lastLightsData = new Float32Array(8 + 4 * 12);
  private lastObjParams = new Float32Array(8);
  private lastUniformViewProj = new Float32Array(16);
  private lastUniformLight = new Float32Array(4);
  private lastUniformCamera = new Float32Array(4);
  private lastUniformShadowParams = new Float32Array(4);
  private shadingBufferDirty = true;
  private shadowMatsBufferDirty = true;
  private gridParamsBufferDirty = true;
  private lightsBufferDirty = true;
  private objectParamsBufferDirty = true;
  private uniformViewProjDirty = true;
  private uniformLightDirty = true;
  private uniformCameraDirty = true;
  private uniformShadowParamsDirty = true;
  private cachedShadowCaster0 = -1;
  private cachedShadowCaster1 = -1;

  private tempProjection = mat4.create();
  private tempLightView = mat4.create();
  private tempLightProj = mat4.create();
  private tempLightViewProj0 = mat4.create();
  private tempLightViewProj1 = mat4.create();
  private tempObjectModel = mat4.create();
  private tempAxisModel = mat4.create();
  private tempLightDirNorm = vec3.create();
  private tempLightUp = vec3.fromValues(0, 1, 0);
  private tempLightBeamDir = vec3.create();
  private tempLightBeamEnd = vec3.create();

  // Метаданные для UI
  getLightsMeta() {
    return {
      count: this.lights.length,
      activeIndex: this.activeLightIndex,
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
    this.lightBeamDirty = true;
    this.markLightDataDirty();
    this.updateLightViewProj();
  }

  // Добавить новый источник (возвращает его индекс)
  addLight(def?: Partial<LightDef>): number {
    if (this.lights.length >= 4) {
      console.warn("Максимум 4 источника света");
      return this.lights.length - 1;
    }

    const light = createLight({ def, objectPos: this.objectPos });
    this.lights.push(light);
    this.markLightDataDirty();
    const idx = this.lights.length - 1;
    this.setActiveLight(idx);
    return idx;
  }

  // Удалить источник (кроме того, чтобы не остаться без единого)
  removeLight(index: number) {
    if (this.lights.length <= 1) {
      console.warn("Должен быть хотя бы один источник света");
      return;
    }

    if (index < 0 || index >= this.lights.length) return;

    this.lights.splice(index, 1);
    this.markLightDataDirty();

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
    this.lightBeamDirty = true;
    this.markLightDataDirty();
    this.updateLightViewProj();
  }

  // Метаданные объектов для UI
  getObjectsMeta() {
    return {
      count: this.objects.length,
      activeIndex: this.activeObjectIndex,
    };
  }

  exportScene(): SceneDTO {
    return createSceneDTO({
      lights: this.lights,
      objects: this.objects,
      defaultMeshId: this.defaultMeshId,
      floorColor: this.floorColor,
      wallColor: this.wallColor,
      showFloor: this.showFloor,
      showWalls: this.showWalls,
      shadowParams: this.shadowParams,
    });
  }

  importScene(scene: SceneDTO) {
    // Свет
    this.lights = lightsFromDTO(scene.lights);

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
    this.lightBeamDirty = true;
    this.markLightDataDirty();
    this.updateLightViewProj();

    // Объекты
    this.objects = objectsFromDTO(scene.objects, this.defaultMeshId);

    if (this.objects.length === 0) {
      this.initDefaultObjects();
    }
    this.activeObjectIndex = 0;
    vec3.copy(this.objectPos, this.objects[0].pos);

    // Пол и стены
    vec3.set(
      this.floorColor,
      scene.floorColor[0],
      scene.floorColor[1],
      scene.floorColor[2],
    );
    vec3.set(
      this.wallColor,
      scene.wallColor[0],
      scene.wallColor[1],
      scene.wallColor[2],
    );
    this.markGridParamsDirty();
    this.showFloor = scene.showFloor;
    this.showWalls = scene.showWalls;

    // Параметры теней
    this.updateShadowParams(scene.shadowParams);

    console.log("✓ Scene imported from JSON");
  }

  setActiveObject(index: number) {
    if (this.objects.length === 0) return;
    const clamped = Math.max(0, Math.min(index, this.objects.length - 1));
    this.activeObjectIndex = clamped;
    const obj = this.objects[clamped];
    vec3.copy(this.objectPos, obj.pos);
  }

  addObject(def?: Partial<SceneObject>): number {
    const id = this.objects.length
      ? this.objects[this.objects.length - 1].id + 1
      : 0;
    const obj = createSceneObject({
      def,
      id,
      objectPos: this.objectPos,
      objectMoveSpeed: this.objectMoveSpeed,
      defaultMeshId: this.defaultMeshId,
    });

    this.objects.push(obj);
    this.activeObjectIndex = this.objects.length - 1;
    vec3.copy(this.objectPos, obj.pos);
    return this.activeObjectIndex;
  }

  removeObject(index: number) {
    if (this.objects.length <= 1) {
      console.warn("Должен быть хотя бы один объект");
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
        shininess: 32.0,
      };
    }
    return {
      color: [obj.color[0], obj.color[1], obj.color[2]] as [
        number,
        number,
        number,
      ],
      castShadows: obj.castShadows,
      receiveShadows: obj.receiveShadows,
      meshId: obj.meshId,
      specular: obj.specular,
      shininess: obj.shininess,
    };
  }

  setActiveObjectSpecular(value: number) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.specular = value;
      this.markObjectParamsDirty();
    }
  }

  setActiveObjectShininess(value: number) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.shininess = value;
      this.markObjectParamsDirty();
    }
  }

  setActiveObjectColor(rgb: [number, number, number]) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      vec3.set(obj.color, rgb[0], rgb[1], rgb[2]);
      this.markObjectParamsDirty();
    }
  }

  setActiveObjectCastShadows(value: boolean) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.castShadows = value;
      this.shadingBufferDirty = true;
      this.shadowMatsBufferDirty = true;
    }
  }

  setActiveObjectReceiveShadows(value: boolean) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.receiveShadows = value;
      this.markObjectParamsDirty();
    }
  }

  setShowLightBeam(value: boolean) {
    this.showLightBeam = value;
    if (value) {
      this.lightBeamDirty = true;
    }
  }

  setObjectMoveSpeed(speed: number) {
    this.objectMoveSpeed = speed;
  }

  setLightMode(mode: LightMode) {
    this.lightMode = mode;
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.type = mode;
      this.lightBeamDirty = true;
      this.markLightDataDirty();
    }
  }

  setLightIntensity(value: number) {
    this.lightIntensity = value;
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.intensity = value;
      this.markLightDataDirty();
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
    this.markGridParamsDirty();
  }

  setWallColor(rgb: [number, number, number]) {
    vec3.set(this.wallColor, rgb[0], rgb[1], rgb[2]);
    this.markGridParamsDirty();
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
    this.lights = createDefaultLights({
      lightDir: this.lightDir,
      lightMode: this.lightMode,
      spotYaw: this.spotYaw,
      spotPitch: this.spotPitch,
      lightIntensity: this.lightIntensity,
    });
    this.activeLightIndex = 0;
    this.lightBeamDirty = true;
    this.markLightDataDirty();
  }

  private initDefaultObjects() {
    this.objects = createDefaultObjects(this.defaultMeshId);
    this.activeObjectIndex = 0;
    vec3.copy(this.objectPos, this.objects[0].pos);
  }

  private getLightModeIndex(): number {
    switch (this.lightMode) {
      case "sun":
        return 0;
      case "spot":
        return 1;
      case "top":
        return 2;
    }
  }

  private getMethodIndex(): number {
    switch (this.shadowParams.method) {
      case "SM":
        return 0;
      case "PCF":
        return 1;
      case "PCSS":
        return 2;
      case "VSM":
        return 3;
    }
  }

  private getMesh(meshId: number): MeshDef {
    return this.meshById.get(meshId) ?? this.meshes[0];
  }

  private static floatArraysEqual(
    left: Float32Array,
    right: Float32Array,
  ): boolean {
    if (left.length !== right.length) return false;

    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return false;
    }

    return true;
  }

  private writeBufferIfChanged(
    buffer: GPUBuffer,
    data: Float32Array,
    lastData: Float32Array,
    force: boolean,
    bufferOffset = 0,
  ): boolean {
    if (!force && Renderer.floatArraysEqual(data, lastData)) {
      return false;
    }

    this.gpu.device.queue.writeBuffer(buffer, bufferOffset, data);
    lastData.set(data);
    return true;
  }

  private markLightDataDirty() {
    this.lightsBufferDirty = true;
    this.shadingBufferDirty = true;
    this.shadowMatsBufferDirty = true;
    this.uniformLightDirty = true;
    this.uniformShadowParamsDirty = true;
  }

  private markGridParamsDirty() {
    this.gridParamsBufferDirty = true;
  }

  private markObjectParamsDirty() {
    this.objectParamsBufferDirty = true;
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
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.ctrlKey || e.shiftKey) return;
      if (this.cameraController.isLocked()) return;
      if (e.button !== 0) return;

      // Если уже выбран объект или свет — пробуем начать drag по оси
      if (this.selection === "object" || this.selection === "light") {
        const axisIndex = this.pickAxisHit(e.clientX, e.clientY);
        if (axisIndex !== -1) {
          this.dragAxisIndex = axisIndex;
          this.dragStartMouseX = e.clientX;
          this.dragStartMouseY = e.clientY;

          if (this.selection === "object") {
            this.isDraggingObject = true;
            vec3.copy(this.objectDragStartPos, this.objectPos);
          } else {
            this.isDraggingLight = true;
            vec3.copy(this.lightDragStartHit, this.lightDir);
          }
          if (this.arcball) this.arcball.enabled = false;

          this.canvas.style.cursor = "move";
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Если выбран свет, НЕ попали по оси и режим = SPOT → вращаем прожектор вокруг себя
        if (this.selection === "light" && this.lightMode === "spot") {
          this.isRotatingLight = true;
          this.rotateStartMouseX = e.clientX;
          this.rotateStartMouseY = e.clientY;
          this.rotateStartYaw = this.spotYaw;
          this.rotateStartPitch = this.spotPitch;

          if (this.arcball) this.arcball.enabled = false;

          this.canvas.style.cursor = "move";
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Иначе — просто выбор объекта/света
      this.handleSelectionClick(e.clientX, e.clientY);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.isDraggingObject && this.dragAxisIndex !== -1) {
        const dx = e.clientX - this.dragStartMouseX;
        const dy = e.clientY - this.dragStartMouseY;

        const proj =
          dx * this.dragAxisScreenDir.x + dy * this.dragAxisScreenDir.y;

        const camPos = this.cameraController.getCameraPosition();
        const toObj = vec3.subtract(
          vec3.create(),
          this.objectDragStartPos,
          camPos,
        );
        const dist = vec3.length(toObj) || 1;

        const worldScale = dist * 0.005 * this.objectMoveSpeed;
        const t = proj * worldScale;

        const newPos = vec3.scaleAndAdd(
          vec3.create(),
          this.objectDragStartPos,
          this.dragAxisWorldDir,
          t,
        );
        vec3.copy(this.objectPos, newPos);

        const obj = this.objects[this.activeObjectIndex];
        if (obj) {
          vec3.copy(obj.pos, newPos);
        }
      } else if (this.isDraggingLight && this.dragAxisIndex !== -1) {
        const dx = e.clientX - this.dragStartMouseX;
        const dy = e.clientY - this.dragStartMouseY;

        const proj =
          dx * this.dragAxisScreenDir.x + dy * this.dragAxisScreenDir.y;

        const camPos = this.cameraController.getCameraPosition();
        const toLight = vec3.subtract(
          vec3.create(),
          this.lightDragStartHit,
          camPos,
        );
        const dist = vec3.length(toLight) || 1;

        const worldScale = dist * 0.005;
        const t = proj * worldScale;

        // новая позиция света вдоль оси
        const newPos = vec3.scaleAndAdd(
          vec3.create(),
          this.lightDragStartHit,
          this.dragAxisWorldDir,
          t,
        );

        const l = this.lights[this.activeLightIndex];
        if (l) {
          vec3.copy(l.pos, newPos);
          this.lightBeamDirty = true;
          this.markLightDataDirty();
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
          this.lightBeamDirty = true;
          this.markLightDataDirty();
        }

        // Активный свет — теневой → обновляем shadow-камеру
        this.updateLightViewProj();
      }
    });

    this.canvas.addEventListener("mouseup", () => {
      if (
        this.isDraggingObject ||
        this.isDraggingLight ||
        this.isRotatingLight
      ) {
        this.isDraggingObject = false;
        this.isDraggingLight = false;
        this.isRotatingLight = false;
        this.dragAxisIndex = -1;
        this.canvas.style.cursor = "default";

        if (this.arcball) this.arcball.enabled = true;
      }
    });

    window.addEventListener("resize", () => {
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
      const t = raySphereHit(rayOrigin, rayDir, center, objectRadius);
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
      const t = raySphereHit(rayOrigin, rayDir, center, lightRadius);
      if (t < bestLightT) {
        bestLightT = t;
        bestLightIndex = i;
      }
    }

    const hasObj = bestObjIndex !== -1;
    const hasLight = bestLightIndex !== -1;

    if (!hasObj && !hasLight) {
      this.setSelection("none");
      return;
    }

    if (hasObj && hasLight) {
      // Берём то, что ближе по лучу
      if (bestLightT < bestObjT) {
        this.setActiveLight(bestLightIndex);
        this.setSelection("light");
      } else {
        this.activeObjectIndex = bestObjIndex;
        const obj = this.objects[this.activeObjectIndex];
        vec3.copy(this.objectPos, obj.pos);
        this.setSelection("object");
      }
      return;
    }

    if (hasLight) {
      this.setActiveLight(bestLightIndex);
      this.setSelection("light");
      return;
    }

    if (hasObj) {
      this.activeObjectIndex = bestObjIndex;
      const obj = this.objects[this.activeObjectIndex];
      vec3.copy(this.objectPos, obj.pos);
      this.setSelection("object");
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
    if (this.selection === "light") {
      originWorld = vec3.clone(this.lightDir);
    } else {
      originWorld = vec3.clone(this.objectPos);
    }

    const axesWorld = [
      vec3.fromValues(1, 0, 0), // X
      vec3.fromValues(0, 1, 0), // Y
      vec3.fromValues(0, 0, 1), // Z
    ];

    let bestAxis = -1;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let axisIndex = 0; axisIndex < axesWorld.length; axisIndex++) {
      const dirWorld = axesWorld[axisIndex]; // уже нормализованный

      const endWorld = vec3.scaleAndAdd(
        vec3.create(),
        originWorld,
        dirWorld,
        axisLength,
      );

      const p0 = projectToScreen(originWorld, this.viewProj, rect);
      const p1 = projectToScreen(endWorld, this.viewProj, rect);
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

  private setSelection(sel: Selection) {
    if (this.selection === sel) return;
    this.selection = sel;

    this.lightSelected = sel === "light";
    this.uniformLightDirty = true;

    if (sel === "object") {
      console.log("Object selected");
      if (this.arcball) this.arcball.enabled = true; // можно вращать мышью
    } else if (sel === "light") {
      console.log("Light selected");
    } else {
      console.log("Selection cleared");
    }
  }

  private createDepth() {
    const { device } = this.gpu;
    const depth = createDepthResource(
      device,
      this.canvas.width,
      this.canvas.height,
      this.depthTex,
    );
    this.depthTex = depth.texture;
    this.depthView = depth.view;
  }

  private createShadowResources() {
    const { device } = this.gpu;
    const resources = createShadowResourceSet(device, this.shadowSize, {
      shadowTex: this.shadowTex,
      shadowTex1: this.shadowTex1,
    });

    this.shadowTex = resources.shadowTex;
    this.shadowView = resources.shadowView;
    this.shadowTex1 = resources.shadowTex1;
    this.shadowView1 = resources.shadowView1;
    this.shadowSampler = resources.shadowSampler;
    this.shadowSamplerLinear = resources.shadowSamplerLinear;

    console.log("✓ Shadow resources created");
  }

  private async createPipelines() {
    const { device, format } = this.gpu;
    const pipelines = createRendererPipelines(device, format);

    this.pipelineSM = pipelines.pipelineSM;
    this.pipelinePCF = pipelines.pipelinePCF;
    this.pipelinePCSS = pipelines.pipelinePCSS;
    this.pipelineVSM = pipelines.pipelineVSM;
    this.vsmMomentsPipeline = pipelines.vsmMomentsPipeline;
    this.blurHorizontalPipeline = pipelines.blurHorizontalPipeline;
    this.shadowPipeline = pipelines.shadowPipeline;
    this.gridPipeline = pipelines.gridPipeline;
    this.lightBeamPipeline = pipelines.lightBeamPipeline;
    this.axisPipeline = pipelines.axisPipeline;
  }

  private createVSMResources() {
    const { device } = this.gpu;
    const resources = createVSMResourceSet(device, this.shadowSize, {
      vsmMomentsTex: this.vsmMomentsTex,
      vsmBlurTex: this.vsmBlurTex,
    });

    this.vsmMomentsTex = resources.vsmMomentsTex;
    this.vsmMomentsView = resources.vsmMomentsView;
    this.vsmBlurTex = resources.vsmBlurTex;
    this.vsmBlurView = resources.vsmBlurView;
    this.vsmSampler = resources.vsmSampler;

    console.log("✓ VSM resources created");
  }

  private createGeometry() {
    const cube = createCubeGeometry();
    this.indexCount = cube.indices.length;
    this.vbo = createBufferFromData(
      this.gpu.device,
      cube.positions,
      GPUBufferUsage.VERTEX,
    );
    this.nbo = createBufferFromData(
      this.gpu.device,
      cube.normals,
      GPUBufferUsage.VERTEX,
    );
    this.tbo = createBufferFromData(
      this.gpu.device,
      cube.uvs,
      GPUBufferUsage.VERTEX,
    );
    this.ibo = createBufferFromData(
      this.gpu.device,
      cube.indices,
      GPUBufferUsage.INDEX,
    );

    this.meshes = [];
    this.meshById.clear();
    const mesh: MeshDef = {
      id: 0,
      name: "Cube",
      vbo: this.vbo,
      nbo: this.nbo,
      tbo: this.tbo,
      ibo: this.ibo,
      indexCount: this.indexCount,
    };
    this.meshes.push(mesh);
    this.meshById.set(mesh.id, mesh);
    this.defaultMeshId = 0;
  }

  private createGrid() {
    const grid = createGridGeometry();
    this.gridVBO = createBufferFromData(
      this.gpu.device,
      grid.positions,
      GPUBufferUsage.VERTEX,
    );
    this.gridNBO = createBufferFromData(
      this.gpu.device,
      grid.normals,
      GPUBufferUsage.VERTEX,
    );
    this.gridTBO = createBufferFromData(
      this.gpu.device,
      grid.uvs,
      GPUBufferUsage.VERTEX,
    );
  }

  private createWalls() {
    const walls = createWallsGeometry();
    this.wallVBO = createBufferFromData(
      this.gpu.device,
      walls.positions,
      GPUBufferUsage.VERTEX,
    );
    this.wallNBO = createBufferFromData(
      this.gpu.device,
      walls.normals,
      GPUBufferUsage.VERTEX,
    );
    this.wallTBO = createBufferFromData(
      this.gpu.device,
      walls.uvs,
      GPUBufferUsage.VERTEX,
    );
  }

  private createLightSphere() {
    const { beam } = createLightMeshesGeometry();

    this.lightBeamVBO = createBufferFromData(
      this.gpu.device,
      beam.vertices,
      GPUBufferUsage.VERTEX,
    );
    this.lightBeamIBO = createBufferFromData(
      this.gpu.device,
      beam.indices,
      GPUBufferUsage.INDEX,
    );
    this.lightBeamIndexCount = 2;
  }

  private createAxisGizmo() {
    const axis = createAxisGizmoGeometry();
    this.axisIndexCount = axis.indices.length;
    this.axisVBO = createBufferFromData(
      this.gpu.device,
      axis.vertices,
      GPUBufferUsage.VERTEX,
    );
    this.axisIBO = createBufferFromData(
      this.gpu.device,
      axis.indices,
      GPUBufferUsage.INDEX,
    );

    console.log("✓ Axis gizmo geometry created");
  }

  private createUniforms() {
    const buffers = createUniformBuffers(this.gpu.device);

    this.uniformBuf = buffers.uniformBuf;
    this.axisUniformBuf = buffers.axisUniformBuf;
    this.shadingBuf = buffers.shadingBuf;
    this.gridParamsBuf = buffers.gridParamsBuf;
    this.objectParamsBuf = buffers.objectParamsBuf;
    this.shadowMatsBuf = buffers.shadowMatsBuf;
    this.lightsBuf = buffers.lightsBuf;
    this.shadingBufferDirty = true;
    this.shadowMatsBufferDirty = true;
    this.gridParamsBufferDirty = true;
    this.lightsBufferDirty = true;
    this.objectParamsBufferDirty = true;
    this.uniformViewProjDirty = true;
    this.uniformLightDirty = true;
    this.uniformCameraDirty = true;
    this.uniformShadowParamsDirty = true;
  }

  private recreateBindGroups() {
    const { device } = this.gpu;

    let currentPipeline = this.pipelineSM;
    if (this.shadowParams.method === "PCF") currentPipeline = this.pipelinePCF;
    if (this.shadowParams.method === "PCSS")
      currentPipeline = this.pipelinePCSS;
    if (this.shadowParams.method === "VSM") currentPipeline = this.pipelineVSM;

    this.bindGroup0Shadow = device.createBindGroup({
      layout: this.shadowPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }],
    });

    this.bindGroup0VSMMoments = device.createBindGroup({
      layout: this.vsmMomentsPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }],
    });

    this.bindGroup0Main = device.createBindGroup({
      layout: currentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.objectParamsBuf } },
        { binding: 2, resource: { buffer: this.shadowMatsBuf } },
      ],
    });

    if (this.shadowParams.method === "PCSS") {
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler },
        ],
      });
    } else if (this.shadowParams.method === "VSM") {
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.vsmBlurView },
          { binding: 1, resource: this.vsmSampler },
        ],
      });
    } else if (this.shadowParams.method === "SM") {
      // SM: две карты теней и два сэмплера (один и тот же)
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler },
          { binding: 2, resource: this.shadowView1 },
          { binding: 3, resource: this.shadowSampler },
        ],
      });
    } else {
      // PCF: одна карта
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler },
        ],
      });
    }

    this.vsmBlurBindGroup0 = device.createBindGroup({
      layout: this.blurHorizontalPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.vsmMomentsView },
        { binding: 1, resource: this.vsmBlurView },
      ],
    });

    this.gridBindGroup = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: { buffer: this.gridParamsBuf } },
        { binding: 2, resource: { buffer: this.shadowMatsBuf } },
      ],
    });

    this.gridBindGroup1 = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: this.shadowView },
        { binding: 1, resource: this.shadowSampler },
      ],
    });

    // Light beam bind group (отдельный layout, но те же Uniforms)
    this.lightBeamBindGroup = device.createBindGroup({
      layout: this.lightBeamPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuf } }],
    });

    // Axis gizmo bind group
    this.axisBindGroup = device.createBindGroup({
      layout: this.axisPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.axisUniformBuf } }],
    });

    // Shading params for main object (group 3) — для текущего метода
    this.shadingBindGroupMain = device.createBindGroup({
      layout: currentPipeline.getBindGroupLayout(3),
      entries: [
        { binding: 0, resource: { buffer: this.shadingBuf } },
        { binding: 1, resource: { buffer: this.lightsBuf } },
      ],
    });

    // Shading params for grid (group 3)
    this.shadingBindGroupGrid = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(3),
      entries: [
        { binding: 0, resource: { buffer: this.shadingBuf } },
        { binding: 1, resource: { buffer: this.lightsBuf } },
      ],
    });

    // Object texture bind group (group = 2) — теперь есть во всех методах
    this.objTexBindGroup = device.createBindGroup({
      layout: currentPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: this.objTextureView },
        { binding: 1, resource: this.objSampler },
      ],
    });

    // Floor texture bind group (grid pipeline group = 2)
    this.floorTexBindGroup = device.createBindGroup({
      layout: this.gridPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: this.floorTextureView },
        { binding: 1, resource: this.floorSampler },
      ],
    });
  }

  private createDefaultTextures() {
    const resources = createDefaultTextureResources(this.gpu.device);

    this.objTexture = resources.objTexture;
    this.objTextureView = resources.objTextureView;
    this.objSampler = resources.objSampler;
    this.floorTexture = resources.floorTexture;
    this.floorTextureView = resources.floorTextureView;
    this.floorSampler = resources.floorSampler;
  }

  private updateViewProj() {
    const aspect = this.canvas.width / this.canvas.height;
    mat4.perspective(
      this.tempProjection,
      (60 * Math.PI) / 180,
      aspect,
      0.1,
      100.0,
    );

    const view = this.cameraController.getViewMatrix();
    mat4.multiply(this.viewProj, this.tempProjection, view);
  }

  private updateLightViewProj() {
    const main = this.lights[this.activeLightIndex];
    const pos = main ? main.pos : this.lightDir;

    const lightDirNorm = vec3.normalize(this.tempLightDirNorm, pos);

    const up = this.tempLightUp;
    vec3.set(up, 0, 1, 0);
    const dotUp = Math.abs(lightDirNorm[1]);
    if (dotUp > 0.99) {
      vec3.set(up, 0, 0, 1);
    }

    mat4.lookAt(this.tempLightView, pos, [0, 0, 0], up);

    const size = 8;
    const near = 1.0;
    const far = 20.0;
    orthoZO(this.tempLightProj, -size, size, -size, size, near, far);

    mat4.multiply(this.lightViewProj, this.tempLightProj, this.tempLightView);

    // lightDir = позиция активного источника (для оси/луча и т.п.)
    vec3.copy(this.lightDir, pos);
  }

  private computeLightViewProjFor(lightIndex: number, out: mat4): mat4 {
    const l = this.lights[lightIndex];
    if (!l) {
      mat4.identity(out);
      return out;
    }
    const lightDirNorm = vec3.normalize(this.tempLightDirNorm, l.pos);

    const up = this.tempLightUp;
    vec3.set(up, 0, 1, 0);
    const dotUp = Math.abs(lightDirNorm[1]);
    if (dotUp > 0.99) {
      vec3.set(up, 0, 0, 1);
    }

    mat4.lookAt(this.tempLightView, l.pos, [0, 0, 0], up);

    const size = 8;
    const near = 1.0;
    const far = 20.0;
    orthoZO(this.tempLightProj, -size, size, -size, size, near, far);

    mat4.multiply(out, this.tempLightProj, this.tempLightView);
    return out;
  }

  private updateLightBeamGeometry() {
    const { device } = this.gpu;
    if (!this.lightBeamVBO) return;
    this.lightBeamDirty = false;

    const active = this.lights[this.activeLightIndex];
    if (!active) {
      device.queue.writeBuffer(this.lightBeamVBO, 0, this.tempZeroBeamVertices);
      return;
    }

    const lightPos = active.pos;
    const floorY = -2.5;

    const dir = this.tempLightBeamDir;

    if (active.type === "spot") {
      vec3.set(
        dir,
        Math.cos(active.pitch) * Math.sin(active.yaw),
        Math.sin(active.pitch),
        Math.cos(active.pitch) * Math.cos(active.yaw),
      );
    } else if (active.type === "top") {
      vec3.set(dir, 0, -1, 0);
    } else {
      // sun
      vec3.set(dir, -lightPos[0], -lightPos[1], -lightPos[2]);
    }

    if (vec3.length(dir) < 1e-3) {
      device.queue.writeBuffer(this.lightBeamVBO, 0, this.tempZeroBeamVertices);
      return;
    }

    vec3.normalize(dir, dir);

    const dy = dir[1];
    const endWorld = this.tempLightBeamEnd;

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

    const verts = this.tempLightBeamVertices;
    verts[0] = lightPos[0];
    verts[1] = lightPos[1];
    verts[2] = lightPos[2];
    verts[3] = endWorld[0];
    verts[4] = endWorld[1];
    verts[5] = endWorld[2];
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

    const visible = ndcX >= -1.0 && ndcX <= 1.0 && ndcY >= -1.0 && ndcY <= 1.0;

    return { x: sx, y: sy, visible };
  }

  getAllLightsScreenPositions(): {
    x: number;
    y: number;
    visible: boolean;
    mode: LightMode;
    active: boolean;
  }[] {
    const rect = this.canvas.getBoundingClientRect();
    const result: {
      x: number;
      y: number;
      visible: boolean;
      mode: LightMode;
      active: boolean;
    }[] = [];

    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      if (!l) continue;

      const lightPos = l.pos;
      const p = vec4.fromValues(lightPos[0], lightPos[1], lightPos[2], 1.0);
      const clip = vec4.create();
      vec4.transformMat4(clip, p, this.viewProj);
      const w = clip[3];

      if (w <= 0.0) {
        result.push({
          x: 0,
          y: 0,
          visible: false,
          mode: l.type,
          active: i === this.activeLightIndex,
        });
        continue;
      }

      const ndcX = clip[0] / w;
      const ndcY = clip[1] / w;

      const sx = (ndcX * 0.5 + 0.5) * rect.width;
      const sy = (1 - (ndcY * 0.5 + 0.5)) * rect.height;

      const visible =
        ndcX >= -1.0 && ndcX <= 1.0 && ndcY >= -1.0 && ndcY <= 1.0;

      result.push({
        x: sx,
        y: sy,
        visible,
        mode: l.type,
        active: i === this.activeLightIndex,
      });
    }

    return result;
  }

  getMeshesMeta() {
    return this.meshes.map((m) => ({ id: m.id, name: m.name }));
  }

  setActiveObjectMesh(meshId: number) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.meshId = meshId;
      this.markObjectParamsDirty();
    }
  }

  setLightColor(rgb: [number, number, number]) {
    const l = this.lights[this.activeLightIndex];
    if (l) {
      vec3.set(l.color, rgb[0], rgb[1], rgb[2]);
      this.markLightDataDirty();
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
        castShadows: true,
      };
    }
    return {
      mode: active.type,
      intensity: active.intensity,
      position: vec3.clone(active.pos),
      color: [active.color[0], active.color[1], active.color[2]] as [
        number,
        number,
        number,
      ],
      castShadows: active.castShadows,
    };
  }

  setActiveLightCastShadows(value: boolean) {
    const l = this.lights[this.activeLightIndex];
    if (!l) return;

    l.castShadows = value;
    this.markLightDataDirty();

    // Пересчёт теневой камеры: по-прежнему привязываем её к первому кастеру
    this.updateLightViewProj();
  }

  async loadObjectTexture(file: File) {
    if (this.objTexture) this.objTexture.destroy();

    const { texture, view } = await createTextureFromImageFile(
      this.gpu.device,
      file,
    );
    this.objTexture = texture;
    this.objTextureView = view;

    this.recreateBindGroups();
  }

  async loadFloorTexture(file: File) {
    if (this.floorTexture) this.floorTexture.destroy();

    const { texture, view } = await createTextureFromImageFile(
      this.gpu.device,
      file,
    );
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

    console.log("✓ Renderer destroyed");
  }

  private frame() {
    const { device, context } = this.gpu;

    this.frameCount++;
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (now - this.lastFpsUpdate > 500) {
      this.currentFps = Math.round(
        (this.frameCount * 1000) / (now - this.lastFpsUpdate),
      );
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      if (this.fpsCallback) {
        this.fpsCallback(this.currentFps);
      }
    }

    const lightModeIndex = this.getLightModeIndex();
    const methodIndex = this.getMethodIndex();

    const casters = this.getShadowCasters(2);
    const caster0 = casters.length > 0 ? casters[0] : -1;
    const caster1 = casters.length > 1 ? casters[1] : -1;

    if (
      caster0 !== this.cachedShadowCaster0 ||
      caster1 !== this.cachedShadowCaster1
    ) {
      this.cachedShadowCaster0 = caster0;
      this.cachedShadowCaster1 = caster1;
      this.shadingBufferDirty = true;
      this.shadowMatsBufferDirty = true;
    }

    if (this.shadingBufferDirty) {
      const shadingData = this.tempShadingData;
      shadingData[0] = this.shadowStrength;
      shadingData[1] = lightModeIndex;
      shadingData[2] = this.spotYaw;
      shadingData[3] = this.spotPitch;
      shadingData[4] = methodIndex;
      shadingData[5] = this.lightIntensity;
      shadingData[6] = caster0;
      shadingData[7] = caster1;
      device.queue.writeBuffer(this.shadingBuf, 0, shadingData);
      this.lastShadingData.set(shadingData);
      this.shadingBufferDirty = false;
    }

    const lightViewProj0 = this.tempLightViewProj0;
    const lightViewProj1 = this.tempLightViewProj1;

    if (this.shadowMatsBufferDirty) {
      mat4.identity(lightViewProj0);
      mat4.identity(lightViewProj1);

      if (caster0 >= 0) {
        this.computeLightViewProjFor(caster0, lightViewProj0);
        mat4.copy(this.lightViewProj, lightViewProj0);
      }

      if (caster1 >= 0) {
        this.computeLightViewProjFor(caster1, lightViewProj1);
      }

      const shadowMats = this.tempShadowMats;
      shadowMats.fill(0);

      if (caster0 >= 0) {
        shadowMats[0] = 1.0;
        shadowMats.set(lightViewProj0, 4);
      }

      if (caster1 >= 0 && caster0 >= 0) {
        shadowMats.set(lightViewProj1, 4 + 16);
        shadowMats[0] = 2.0;
      }

      device.queue.writeBuffer(this.shadowMatsBuf, 0, shadowMats);
      this.lastShadowMats.set(shadowMats);
      this.shadowMatsBufferDirty = false;
    }

    if (this.gridParamsBufferDirty) {
      const gridParams = this.tempGridParams;
      gridParams[0] = this.floorColor[0];
      gridParams[1] = this.floorColor[1];
      gridParams[2] = this.floorColor[2];
      gridParams[4] = this.wallColor[0];
      gridParams[5] = this.wallColor[1];
      gridParams[6] = this.wallColor[2];
      device.queue.writeBuffer(this.gridParamsBuf, 0, gridParams);
      this.lastGridParams.set(gridParams);
      this.gridParamsBufferDirty = false;
    }

    if (this.lightsBufferDirty) {
      const maxLights = 4;
      const lightStructFloats = 12;
      const lightsData = this.tempLightsData;
      lightsData.fill(0);

      const count = Math.min(this.lights.length || 1, maxLights);
      lightsData[0] = count;

      for (let i = 0; i < count; i++) {
        const l = this.lights[i];
        const base = 8 + i * lightStructFloats;

        lightsData[base + 0] = l?.pos[0] ?? this.lightDir[0];
        lightsData[base + 1] = l?.pos[1] ?? this.lightDir[1];
        lightsData[base + 2] = l?.pos[2] ?? this.lightDir[2];
        lightsData[base + 3] =
          (l?.type ?? this.lightMode) === "sun"
            ? 0
            : (l?.type ?? this.lightMode) === "spot"
              ? 1
              : 2;
        lightsData[base + 4] = l?.yaw ?? this.spotYaw;
        lightsData[base + 5] = l?.pitch ?? this.spotPitch;
        lightsData[base + 6] = l?.intensity ?? this.lightIntensity;
        lightsData[base + 8] = l?.color[0] ?? 1.0;
        lightsData[base + 9] = l?.color[1] ?? 1.0;
        lightsData[base + 10] = l?.color[2] ?? 1.0;
      }

      device.queue.writeBuffer(this.lightsBuf, 0, lightsData);
      this.lastLightsData.set(lightsData);
      this.lightsBufferDirty = false;
    }

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
    mat4.fromTranslation(this.model, this.objectPos);
    mat4.multiply(this.model, this.model, rotation);

    const lightPos = this.lightDir;

    const camPos = this.cameraController.getCameraPosition();

    device.queue.writeBuffer(this.uniformBuf, 0, this.model as Float32Array);

    if (
      this.writeBufferIfChanged(
        this.uniformBuf,
        this.viewProj as Float32Array,
        this.lastUniformViewProj,
        this.uniformViewProjDirty,
        16 * 4,
      )
    ) {
      this.uniformViewProjDirty = false;
    }

    device.queue.writeBuffer(
      this.uniformBuf,
      32 * 4,
      this.lightViewProj as Float32Array,
    );

    const lightUniform = this.tempLightUniform;
    lightUniform[0] = lightPos[0];
    lightUniform[1] = lightPos[1];
    lightUniform[2] = lightPos[2];
    lightUniform[3] = this.lightSelected ? 1 : 0;
    if (
      this.writeBufferIfChanged(
        this.uniformBuf,
        lightUniform,
        this.lastUniformLight,
        this.uniformLightDirty,
        48 * 4,
      )
    ) {
      this.uniformLightDirty = false;
    }

    const cameraUniform = this.tempCameraUniform;
    cameraUniform[0] = camPos[0];
    cameraUniform[1] = camPos[1];
    cameraUniform[2] = camPos[2];
    cameraUniform[3] = 1.0;
    if (
      this.writeBufferIfChanged(
        this.uniformBuf,
        cameraUniform,
        this.lastUniformCamera,
        this.uniformCameraDirty,
        52 * 4,
      )
    ) {
      this.uniformCameraDirty = false;
    }

    const shadowParamsUniform = this.tempShadowParamsUniform;
    if (this.shadowParams.method === "PCSS") {
      shadowParamsUniform[0] = this.shadowParams.bias;
      shadowParamsUniform[1] = this.shadowParams.pcssLightSize;
      shadowParamsUniform[2] = this.shadowParams.pcssBlockerSearchSamples;
      shadowParamsUniform[3] = this.shadowParams.shadowMapSize;
    } else if (this.shadowParams.method === "VSM") {
      shadowParamsUniform[0] = this.shadowParams.vsmMinVariance;
      shadowParamsUniform[1] = this.shadowParams.vsmLightBleedReduction;
      shadowParamsUniform[2] = 0;
      shadowParamsUniform[3] = 0;
    } else if (this.shadowParams.method === "SM") {
      shadowParamsUniform[0] = this.shadowParams.bias;
      shadowParamsUniform[1] = lightModeIndex;
      shadowParamsUniform[2] = this.spotYaw;
      shadowParamsUniform[3] = this.spotPitch;
    } else {
      shadowParamsUniform[0] = this.shadowParams.bias;
      shadowParamsUniform[1] = this.shadowParams.pcfRadius;
      shadowParamsUniform[2] = this.shadowParams.pcfSamples;
      shadowParamsUniform[3] = this.shadowParams.shadowMapSize;
    }
    if (
      this.writeBufferIfChanged(
        this.uniformBuf,
        shadowParamsUniform,
        this.lastUniformShadowParams,
        this.uniformShadowParamsDirty,
        56 * 4,
      )
    ) {
      this.uniformShadowParamsDirty = false;
    }

    // Обновляем uniform для gizmo (оси объекта или света)
    if (this.selection !== "none") {
      const axisModel = this.tempAxisModel;

      if (this.selection === "object") {
        mat4.copy(axisModel, this.model);
      } else {
        mat4.fromTranslation(axisModel, this.lightDir);
      }

      const tmpAxis = this.tempAxisUniform;
      tmpAxis.set(axisModel, 0);
      tmpAxis.set(this.viewProj, 16);
      tmpAxis.set(this.lightViewProj, 32);
      tmpAxis[48] = lightPos[0];
      tmpAxis[49] = lightPos[1];
      tmpAxis[50] = lightPos[2];
      tmpAxis[51] = this.lightSelected ? 1 : 0;
      tmpAxis[52] = camPos[0];
      tmpAxis[53] = camPos[1];
      tmpAxis[54] = camPos[2];
      tmpAxis[55] = 1.0;
      tmpAxis.set(shadowParamsUniform, 56);

      device.queue.writeBuffer(this.axisUniformBuf, 0, tmpAxis.buffer);
    }
    if (this.lightBeamDirty) {
      this.updateLightBeamGeometry();
    }

    const encoder = device.createCommandEncoder();

    // Shadow pass
    if (this.shadowParams.method === "VSM") {
      const vsmPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.vsmMomentsView,
            clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: this.shadowView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      vsmPass.setPipeline(this.vsmMomentsPipeline);
      vsmPass.setBindGroup(0, this.bindGroup0VSMMoments);

      for (const obj of this.objects) {
        if (!obj.castShadows) continue;

        const mesh = this.getMesh(obj.meshId);
        vsmPass.setVertexBuffer(0, mesh.vbo);
        vsmPass.setIndexBuffer(mesh.ibo, "uint16");

        const modelMat = this.tempObjectModel;
        mat4.fromTranslation(modelMat, obj.pos);
        mat4.multiply(modelMat, modelMat, rotation);
        device.queue.writeBuffer(this.uniformBuf, 0, modelMat as Float32Array);

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
      if (this.shadowParams.method === "SM") {
        // PASS 0: caster0 -> shadowView
        if (caster0 >= 0) {
          const shadowPass0 = encoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
              view: this.shadowView,
              depthClearValue: 1.0,
              depthLoadOp: "clear",
              depthStoreOp: "store",
            },
          });
          shadowPass0.setPipeline(this.shadowPipeline);
          shadowPass0.setBindGroup(0, this.bindGroup0Shadow);
          device.queue.writeBuffer(
            this.uniformBuf,
            32 * 4,
            lightViewProj0 as Float32Array,
          );

          for (const obj of this.objects) {
            if (!obj.castShadows) continue;

            const mesh = this.getMesh(obj.meshId);
            shadowPass0.setVertexBuffer(0, mesh.vbo);
            shadowPass0.setIndexBuffer(mesh.ibo, "uint16");

            const modelMat = this.tempObjectModel;
            mat4.fromTranslation(modelMat, obj.pos);
            mat4.multiply(modelMat, modelMat, rotation);

            device.queue.writeBuffer(
              this.uniformBuf,
              0,
              modelMat as Float32Array,
            );

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
              depthLoadOp: "clear",
              depthStoreOp: "store",
            },
          });
          shadowPass1.setPipeline(this.shadowPipeline);
          shadowPass1.setBindGroup(0, this.bindGroup0Shadow);
          device.queue.writeBuffer(
            this.uniformBuf,
            32 * 4,
            lightViewProj1 as Float32Array,
          );

          for (const obj of this.objects) {
            if (!obj.castShadows) continue;

            const mesh = this.getMesh(obj.meshId);
            shadowPass1.setVertexBuffer(0, mesh.vbo);
            shadowPass1.setIndexBuffer(mesh.ibo, "uint16");

            const modelMat = this.tempObjectModel;
            mat4.fromTranslation(modelMat, obj.pos);
            mat4.multiply(modelMat, modelMat, rotation);

            device.queue.writeBuffer(
              this.uniformBuf,
              0,
              modelMat as Float32Array,
            );

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
            depthLoadOp: "clear",
            depthStoreOp: "store",
          },
        });
        shadowPass.setPipeline(this.shadowPipeline);
        shadowPass.setBindGroup(0, this.bindGroup0Shadow);

        for (const obj of this.objects) {
          if (!obj.castShadows) continue;

          const mesh = this.getMesh(obj.meshId);
          shadowPass.setVertexBuffer(0, mesh.vbo);
          shadowPass.setIndexBuffer(mesh.ibo, "uint16");

          const modelMat = this.tempObjectModel;
          mat4.fromTranslation(modelMat, obj.pos);
          mat4.multiply(modelMat, modelMat, rotation);
          device.queue.writeBuffer(
            this.uniformBuf,
            0,
            modelMat as Float32Array,
          );

          shadowPass.drawIndexed(mesh.indexCount);
        }
        shadowPass.end();
      }
    }

    // Scene pass: main objects, floor/walls, light beam and axis gizmo share color/depth attachments.
    let currentPipeline = this.pipelineSM;
    if (this.shadowParams.method === "PCF") currentPipeline = this.pipelinePCF;
    if (this.shadowParams.method === "PCSS")
      currentPipeline = this.pipelinePCSS;
    if (this.shadowParams.method === "VSM") currentPipeline = this.pipelineVSM;

    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.08, g: 0.09, b: 0.11, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    scenePass.setPipeline(currentPipeline);
    scenePass.setBindGroup(0, this.bindGroup0Main);
    scenePass.setBindGroup(1, this.bindGroup1Main);
    scenePass.setBindGroup(2, this.objTexBindGroup);

    if (this.shadingBindGroupMain) {
      scenePass.setBindGroup(3, this.shadingBindGroupMain);
    }

    for (const obj of this.objects) {
      const mesh = this.getMesh(obj.meshId);
      scenePass.setVertexBuffer(0, mesh.vbo);
      scenePass.setVertexBuffer(1, mesh.nbo);
      scenePass.setVertexBuffer(2, mesh.tbo);
      scenePass.setIndexBuffer(mesh.ibo, "uint16");

      const modelMat = this.tempObjectModel;
      mat4.fromTranslation(modelMat, obj.pos);
      mat4.multiply(modelMat, modelMat, rotation);
      device.queue.writeBuffer(this.uniformBuf, 0, modelMat as Float32Array);

      const objParams = this.tempObjParams;
      objParams[0] = obj.color[0];
      objParams[1] = obj.color[1];
      objParams[2] = obj.color[2];
      objParams[3] = obj.receiveShadows ? 1.0 : 0.0;
      objParams[4] = obj.specular;
      objParams[5] = obj.shininess;
      objParams[6] = 0.0;
      objParams[7] = 0.0;
      if (
        this.writeBufferIfChanged(
          this.objectParamsBuf,
          objParams,
          this.lastObjParams,
          this.objectParamsBufferDirty,
        )
      ) {
        this.objectParamsBufferDirty = false;
      }

      scenePass.drawIndexed(mesh.indexCount);
    }

    scenePass.setPipeline(this.gridPipeline);
    scenePass.setBindGroup(0, this.gridBindGroup);
    scenePass.setBindGroup(1, this.gridBindGroup1);
    scenePass.setBindGroup(2, this.floorTexBindGroup);
    scenePass.setBindGroup(3, this.shadingBindGroupGrid);

    if (this.showFloor) {
      scenePass.setVertexBuffer(0, this.gridVBO);
      scenePass.setVertexBuffer(1, this.gridNBO);
      scenePass.setVertexBuffer(2, this.gridTBO);
      scenePass.draw(6);
    }

    if (this.showWalls) {
      scenePass.setVertexBuffer(0, this.wallVBO);
      scenePass.setVertexBuffer(1, this.wallNBO);
      scenePass.setVertexBuffer(2, this.wallTBO);
      scenePass.draw(12); // 2 стены по 6 вершин каждая
    }

    if (this.showLightBeam) {
      scenePass.setPipeline(this.lightBeamPipeline);
      scenePass.setBindGroup(0, this.lightBeamBindGroup);
      scenePass.setVertexBuffer(0, this.lightBeamVBO);
      scenePass.setIndexBuffer(this.lightBeamIBO, "uint16");
      scenePass.drawIndexed(this.lightBeamIndexCount);
    }

    if (this.selection === "object" || this.selection === "light") {
      scenePass.setPipeline(this.axisPipeline);
      scenePass.setVertexBuffer(0, this.axisVBO);
      scenePass.setIndexBuffer(this.axisIBO, "uint16");
      scenePass.setBindGroup(0, this.axisBindGroup);
      scenePass.drawIndexed(this.axisIndexCount);
    }

    scenePass.end();

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
      pcssBlockerSearchSamples:
        params.pcssBlockerSearchSamples ??
        this.shadowParams.pcssBlockerSearchSamples,
      vsmMinVariance: params.vsmMinVariance ?? this.shadowParams.vsmMinVariance,
      vsmLightBleedReduction:
        params.vsmLightBleedReduction ??
        this.shadowParams.vsmLightBleedReduction,
      shadowStrength: params.shadowStrength ?? this.shadowParams.shadowStrength,
    };
    this.shadowStrength = this.shadowParams.shadowStrength ?? 1.0;
    this.shadingBufferDirty = true;
    this.uniformShadowParamsDirty = true;

    // Пересоздаём ресурсы если изменился размер
    if (sizeChanged) {
      this.shadowSize = params.shadowMapSize;
      this.createShadowResources();
      this.createVSMResources();
      this.shadowMatsBufferDirty = true;
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
    vec3.set(this.lightDir, 5, 10, 3);
    this.lightMode = "sun";
    this.lightIntensity = 1.0;
    this.initSpotOrientationFromPosition();
    this.initDefaultLights();
    this.lightBeamDirty = true;
    this.updateLightViewProj();

    // Сбрасываем тип света и силу теней
    this.lightMode = "sun";
    this.shadowParams.shadowStrength = 1.0;
    this.shadowStrength = 1.0;

    // Сбрасываем вращение объекта
    this.arcball.reset();

    // Сбрасываем позицию объекта и выделение
    vec3.set(this.objectPos, 0, 0, 0);
    this.selection = "none";
    this.isDraggingObject = false;
    this.isDraggingLight = false;
    this.dragAxisIndex = -1;
    this.canvas.style.cursor = "default";

    console.log(
      "✓ Scene reset to defaults (camera/light/object/light/shadows)",
    );
  }

  resetModel() {
    // Возвращаем дефолтную геометрию (куб)
    this.createGeometry();

    // Все объекты снова используют куб
    for (const obj of this.objects) {
      obj.meshId = this.defaultMeshId;
    }
    this.markObjectParamsDirty();

    console.log("✓ Model reset to default cube");
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
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(vbo, 0, model.positions.buffer);

      const nbo = device.createBuffer({
        size: model.normals.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(nbo, 0, model.normals.buffer);

      const ibo = device.createBuffer({
        size: model.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
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
        indexCount,
      };

      this.meshes.push(mesh);
      this.meshById.set(mesh.id, mesh);

      // Назначаем новую модель активному объекту
      const obj = this.objects[this.activeObjectIndex];
      if (obj) {
        obj.meshId = newId;
        this.markObjectParamsDirty();
      }

      console.log(
        `✓ Loaded OBJ mesh #${newId}: ${model.positions.length / 3} vertices, ${indexCount / 3} triangles`,
      );
    } catch (e) {
      console.error("Failed to load OBJ:", e);
      alert(`Ошибка загрузки модели: ${e}`);
    }
  }
}
