import { mat4, vec3, vec4 } from "gl-matrix";
import { initWebGPU } from "../gpu/initWebGPU";
import { ArcballController } from "./ArcballController";
import { CameraController } from "./CameraController";
import {
  createAxisGizmoGeometry,
  createGridGeometry,
  createLightMeshesGeometry,
  createWallsGeometry,
} from "./geometryData";
import { orthoZO, perspectiveZO } from "./math";
import { createRendererPipelines } from "./pipelines";
import {
  createBufferFromData,
  createDefaultTextureResources,
  createDepthResource,
  createUniformBuffers,
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
import { validateSceneDTO } from "../utils/sceneValidation";
import { SCENE_PRESETS, type ScenePresetId } from "./presets";
import {
  getShadowProjectionDescriptor,
  getShadowTargetForLight,
  getStableShadowUp,
} from "./shadowDescriptors";
import { buildShadowSlots, type ShadowSlot } from "./shadowSlots";
import { ShadowRenderer } from "./ShadowRenderer";
import { MeshRegistry } from "./MeshRegistry";
import { ObjectDrawStateRegistry, type ObjectDrawState } from "./ObjectDrawStateRegistry";
import { ObjectUniformWriter } from "./ObjectUniformWriter";
import { MAX_LIGHTS, MAX_SHADOW_SLOTS, getShadowSlotLabels, selectShadowCasters } from "./shadows";
import {
  LIGHTS_DATA_FLOATS,
  SHADING_FLOATS,
  SHADOW_MATS_FLOATS,
  SHADOW_MATS_HEADER_FLOATS,
  writeLightToBuffer,
  writeShadingParamsToBuffer,
} from "./uniformLayouts";
import type {
  GPUCtx,
  LightDef,
  LightMode,
  PerformanceMetrics,
  SceneDTO,
  SceneObject,
  Selection,
  ShadowDebugMode,
  LightDebugMode,
  ShadowMethod,
} from "./types";

export type { LightMode, PerformanceMetrics, ShadowDebugMode, ShadowMethod } from "./types";

export type DeviceLostHandler = (message: string) => void;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private gpu!: GPUCtx;
  private pipelineSM!: GPURenderPipeline;
  private pipelinePCF!: GPURenderPipeline;
  private pipelinePCSS!: GPURenderPipeline;
  private pipelineVSM!: GPURenderPipeline;
  private vsmMomentsPipeline!: GPURenderPipeline;
  private blurHorizontalPipeline!: GPUComputePipeline;
  private blurVerticalPipeline!: GPUComputePipeline;
  private shadowPipeline!: GPURenderPipeline;
  private debugShadowDepthPipeline!: GPURenderPipeline;
  private debugVsmPipeline!: GPURenderPipeline;
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
  private shadowRenderer = new ShadowRenderer();

  private lightBeamPipeline!: GPURenderPipeline;
  private lightBeamVBO!: GPUBuffer;
  private lightBeamIBO!: GPUBuffer;
  private lightBeamIndexCount = 0;

  private lightBeamBindGroup!: GPUBindGroup;

  private dragAxisIndex: number = -1; // 0 = X, 1 = Y, 2 = Z
  private dragAxisWorldDir = vec3.create(); // направление оси в мире
  private dragAxisScreenDir = { x: 0, y: 0 }; // направление оси на экране
  private dragStartMouseX = 0;
  private dragStartMouseY = 0;
  private objectAutoRotate = true;
  private sharedRotationCenter = false;

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
  private objectKeyboardKeys = new Set<string>();

  private isDraggingLight = false;
  private lightDragStartHit = vec3.create();

  private uniformBuf!: GPUBuffer;
  private axisUniformBuf!: GPUBuffer;
  private bindGroup1Main!: GPUBindGroup;
  private vsmBlurBindGroups!: { horizontal: GPUBindGroup; vertical: GPUBindGroup };
  private debugShadowBindGroups: GPUBindGroup[] = [];
  private debugVsmBindGroups: GPUBindGroup[] = [];

  private gridParamsBuf!: GPUBuffer;
  private shadingBuf!: GPUBuffer;
  private shadingBindGroupMain: GPUBindGroup | null = null;
  private shadingBindGroupGrid!: GPUBindGroup;
  private lightsBuf!: GPUBuffer;
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
  private deviceLost = false;
  private deviceLostHandler: DeviceLostHandler | null = null;

  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private performanceStartTime = performance.now();
  private totalFrameCount = 0;
  private currentFps = 0;
  private currentFrameTimeMs = 0;
  private frameTimeHistory: number[] = [];
  private fpsSampleHistory: number[] = [];
  private sessionMinFps = Number.POSITIVE_INFINITY;
  private sessionMaxFps = 0;
  private sessionFrameTimeSumMs = 0;
  private sessionFrameCount = 0;
  private sessionMaxFrameTimeMs = 0;
  private lastFpsSampleDurationMs = 0;
  private performanceCallback?: (metrics: PerformanceMetrics) => void;

  private shadowParams = {
    shadowMapSize: 2048,
    bias: 0.003,
    method: "SM" as ShadowMethod,
    pcfRadius: 2.5,
    pcfSamples: 8,
    pcssLightSize: 0.08,
    pcssBlockerSearchSamples: 8,
    vsmMinVariance: 0.0001,
    vsmLightBleedReduction: 0.2,
    shadowStrength: 1.0,
    ambientStrength: 0.4,
    exposure: 0.9,
    hemisphereSkyColor: [0.62, 0.68, 0.78] as [number, number, number],
    hemisphereGroundColor: [0.18, 0.16, 0.14] as [number, number, number],
    lightDebugMode: "final" as LightDebugMode,
    debugShadowMap: "off" as ShadowDebugMode,
  };
  private lightMode: LightMode = "sun";
  private shadowStrength = 1.0;

  private showFloor = true;
  private showWalls = true;
  private floorSize = 10;
  private showGrid = true;
  private floorColor = vec3.fromValues(0.15, 0.16, 0.18);
  private wallColor = vec3.fromValues(0.1, 0.11, 0.13);
  private objectMoveSpeed = 1.0;
  private lightIntensity = 1.0;
  private showLightBeam = true;

  private lights: LightDef[] = [];
  private activeLightIndex = 0;

  private meshRegistry = new MeshRegistry();

  private lightBeamDirty = true;

  private tempShadingData = new Float32Array(SHADING_FLOATS);
  private tempShadowMats = new Float32Array(SHADOW_MATS_FLOATS);
  private tempGridParams = new Float32Array(12);
  private tempLightsData = new Float32Array(LIGHTS_DATA_FLOATS);
  private tempAxisUniform = new Float32Array(16 * 3 + 4 * 3);
  private tempLightUniform = new Float32Array(4);
  private tempCameraUniform = new Float32Array(4);
  private tempShadowParamsUniform = new Float32Array(4);
  private tempShadowSlotParamsUniforms = Array.from({ length: MAX_SHADOW_SLOTS }, () => new Float32Array(4));
  private tempLightBeamVertices = new Float32Array(6);
  private tempZeroBeamVertices = new Float32Array(6);
  private lastShadingData = new Float32Array(SHADING_FLOATS);
  private lastShadowMats = new Float32Array(SHADOW_MATS_FLOATS);
  private lastGridParams = new Float32Array(12);
  private lastLightsData = new Float32Array(LIGHTS_DATA_FLOATS);
  private lastUniformViewProj = new Float32Array(16);
  private lastUniformLight = new Float32Array(4);
  private lastUniformCamera = new Float32Array(4);
  private lastUniformShadowParams = new Float32Array(4);
  private shadingBufferDirty = true;
  private shadowMatsBufferDirty = true;
  private gridParamsBufferDirty = true;
  private lightsBufferDirty = true;
  private uniformViewProjDirty = true;
  private uniformLightDirty = true;
  private uniformCameraDirty = true;
  private uniformShadowParamsDirty = true;
  private cachedShadowCaster0 = -1;
  private cachedShadowCaster1 = -1;

  private tempProjection = mat4.create();
  private tempLightView = mat4.create();
  private tempLightProj = mat4.create();
  private tempLightViewProjs = Array.from({ length: MAX_SHADOW_SLOTS }, () => mat4.create());
  private tempAxisModel = mat4.create();
  private tempSharedRotationCenter = vec3.create();
  private tempActiveRotationOffset = vec3.create();
  private tempLightDirNorm = vec3.create();
  private tempLightUp = vec3.fromValues(0, 1, 0);
  private tempLightBeamDir = vec3.create();
  private tempLightBeamEnd = vec3.create();
  private objectDrawStates = new ObjectDrawStateRegistry();
  private objectUniformWriter = new ObjectUniformWriter();

  // Метаданные для UI
  getLightsMeta() {
    return {
      count: this.lights.length,
      activeIndex: this.activeLightIndex,
      names: this.lights.map((light, index) => light.name || `Light ${index + 1}`),
      shadowSlots: getShadowSlotLabels(this.lights.length, this.getMaxShadowSlotsForMethod()),
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
    if (this.lights.length >= MAX_LIGHTS) {
      console.warn(`Можно добавить не больше ${MAX_LIGHTS} источников света`);
      return this.activeLightIndex;
    }

    const light = createLight({
      def: {
        ...def,
        name: def?.name ?? `Light ${this.lights.length + 1}`,
        castShadows: true,
      },
      objectPos: this.objectPos,
    });
    if (light.type === "spot" && def?.yaw === undefined && def?.pitch === undefined) {
      this.pointSpotLightAtSceneTarget(light);
    }
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
      names: this.objects.map((object, index) => object.name || `Object ${index + 1}`),
    };
  }

  renameLight(index: number, name: string) {
    const light = this.lights[index];
    if (!light) return;
    light.name = name.trim() || `Light ${index + 1}`;
  }

  renameObject(index: number, name: string) {
    const object = this.objects[index];
    if (!object) return;
    object.name = name.trim() || `Object ${index + 1}`;
  }

  exportScene(): SceneDTO {
    return createSceneDTO({
      lights: this.lights,
      objects: this.objects,
      defaultMeshId: this.meshRegistry.defaultMeshId,
      floorColor: this.floorColor,
      wallColor: this.wallColor,
      showFloor: this.showFloor,
      showWalls: this.showWalls,
      floorSize: this.floorSize,
      showGrid: this.showGrid,
      shadowParams: this.shadowParams,
    });
  }

  importScene(scene: SceneDTO) {
    const safeScene = validateSceneDTO(scene);

    // Свет
    this.lights = lightsFromDTO(safeScene.lights).slice(0, MAX_LIGHTS);

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
    this.objects = objectsFromDTO(safeScene.objects, this.meshRegistry.defaultMeshId).map((object) => ({
      ...object,
      meshId: this.meshRegistry.has(object.meshId) ? object.meshId : this.meshRegistry.defaultMeshId,
    }));

    if (this.objects.length === 0) {
      this.initDefaultObjects();
    }
    this.activeObjectIndex = 0;
    vec3.copy(this.objectPos, this.objects[0].pos);

    // Пол и стены
    vec3.set(
      this.floorColor,
      safeScene.floorColor[0],
      safeScene.floorColor[1],
      safeScene.floorColor[2],
    );
    vec3.set(
      this.wallColor,
      safeScene.wallColor[0],
      safeScene.wallColor[1],
      safeScene.wallColor[2],
    );
    this.markGridParamsDirty();
    this.showFloor = safeScene.showFloor;
    this.showWalls = safeScene.showWalls;
    this.floorSize = safeScene.floorSize ?? 10;
    this.showGrid = safeScene.showGrid ?? true;
    this.createGrid();
    this.createWalls();

    // Параметры теней
    this.updateShadowParams(safeScene.shadowParams);

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
      defaultMeshId: this.meshRegistry.defaultMeshId,
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
        scale: [1, 1, 1] as [number, number, number],
        castShadows: true,
        receiveShadows: false,
        selfShadows: false,
        meshId: this.meshRegistry.defaultMeshId,
        specular: 0.5,
        shininess: 32.0,
        roughness: 0.45,
      };
    }
    return {
      color: [obj.color[0], obj.color[1], obj.color[2]] as [
        number,
        number,
        number,
      ],
      scale: [obj.scale[0], obj.scale[1], obj.scale[2]] as [
        number,
        number,
        number,
      ],
      castShadows: obj.castShadows,
      receiveShadows: obj.receiveShadows,
      selfShadows: obj.selfShadows,
      meshId: obj.meshId,
      specular: obj.specular,
      shininess: obj.shininess,
      roughness: obj.roughness,
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
      obj.roughness = Math.max(0.02, Math.min(1, 1 - (value - 4) / 124));
      this.markObjectParamsDirty();
    }
  }

  setActiveObjectRoughness(value: number) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.roughness = value;
      obj.shininess = 4 + (1 - value) * 124;
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

  setActiveObjectScale(scale: [number, number, number]) {
    const obj = this.objects[this.activeObjectIndex];
    if (!obj) return;

    vec3.set(
      obj.scale,
      Math.max(0.01, Math.min(100, scale[0])),
      Math.max(0.01, Math.min(100, scale[1])),
      Math.max(0.01, Math.min(100, scale[2])),
    );
    this.shadowMatsBufferDirty = true;
    this.updateLightViewProj();
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

  setActiveObjectSelfShadows(value: boolean) {
    const obj = this.objects[this.activeObjectIndex];
    if (obj) {
      obj.selfShadows = value;
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
      const previousMode = l.type;
      l.type = mode;
      if (mode === "spot" && previousMode !== "spot") {
        this.pointSpotLightAtSceneTarget(l);
        this.spotYaw = l.yaw;
        this.spotPitch = l.pitch;
      }
      this.lightBeamDirty = true;
      this.markLightDataDirty();
      this.updateLightViewProj();
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

  setActiveLightSpotInnerCone(value: number) {
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.innerConeDeg = Math.min(value, l.outerConeDeg - 1);
      this.markLightDataDirty();
      this.updateLightViewProj();
    }
  }

  setActiveLightSpotOuterCone(value: number) {
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.outerConeDeg = Math.max(value, l.innerConeDeg + 1);
      this.markLightDataDirty();
      this.updateLightViewProj();
    }
  }

  setActiveLightSpotRange(value: number) {
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.range = value;
      this.markLightDataDirty();
      this.updateLightViewProj();
    }
  }

  setActiveLightSpotFalloff(value: number) {
    const l = this.lights[this.activeLightIndex];
    if (l) {
      l.falloff = value;
      this.markLightDataDirty();
    }
  }

  setObjectAutoRotate(enabled: boolean) {
    this.objectAutoRotate = enabled;
  }

  setSharedRotationCenter(enabled: boolean) {
    this.sharedRotationCenter = enabled;
  }

  setDeviceLostHandler(handler: DeviceLostHandler | null) {
    this.deviceLostHandler = handler;
  }

  getObjectAutoRotate() {
    return this.objectAutoRotate;
  }

  getSharedRotationCenter() {
    return this.sharedRotationCenter;
  }

  setBenchmarkOrbitView(theta: number, phi: number, distance: number, target?: [number, number, number]) {
    this.cameraController.setOrbitView(theta, phi, distance, target);
    this.updateViewProj();
  }

  setFloorVisible(visible: boolean) {
    this.showFloor = visible;
  }

  setWallsVisible(visible: boolean) {
    this.showWalls = visible;
  }

  setFloorSize(size: number) {
    const nextSize = Math.max(4, Math.min(30, size));
    if (Math.abs(this.floorSize - nextSize) < 0.001) return;

    this.floorSize = nextSize;
    this.createGrid();
    this.createWalls();
    this.markGridParamsDirty();
  }

  setGridVisible(visible: boolean) {
    this.showGrid = visible;
    this.markGridParamsDirty();
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
    return selectShadowCasters(this.lights.length, max);
  }

  private getMaxShadowSlotsForMethod(): number {
    return MAX_SHADOW_SLOTS;
  }

  private getDebugShadowSlotIndex(): number | null {
    const mode = this.shadowParams.debugShadowMap ?? "off";
    if (mode === "off") return null;
    if (mode === "primary") return 0;
    if (mode === "secondary") return 1;

    const match = /^slot([0-7])$/.exec(mode);
    if (!match) return 0;
    return Number(match[1]);
  }

  private getShadowSlotBindGroup(state: ObjectDrawState, slotIndex: number): GPUBindGroup {
    return state.shadowBindGroups[slotIndex];
  }

  private getVsmMomentsSlotBindGroup(state: ObjectDrawState, slotIndex: number): GPUBindGroup {
    return state.vsmMomentsBindGroups[slotIndex];
  }

  private getDebugShadowSlotBindGroup(state: ObjectDrawState, slotIndex: number): GPUBindGroup {
    return state.debugShadowDepthBindGroups[slotIndex];
  }

  private buildShadowSlots(casters: number[]): ShadowSlot[] {
    return buildShadowSlots({
      casters,
      maxSlots: MAX_SHADOW_SLOTS,
      lightViewProjs: this.tempLightViewProjs,
      computeLightViewProj: (lightIndex, out) => this.computeLightViewProjFor(lightIndex, out),
      getSlotViews: (slotIndex) => ({
        depthView: this.shadowLayerViews[slotIndex],
        debugView: this.shadowDebugViews[slotIndex] ?? this.shadowDebugViews[0],
      }),
    });
  }

  private writeShadowMatrices(slots: ShadowSlot[]) {
    const shadowMats = this.tempShadowMats;
    shadowMats.fill(0);
    shadowMats[0] = slots.length;

    for (const slot of slots) {
      shadowMats.set(slot.lightViewProj, SHADOW_MATS_HEADER_FLOATS + slot.slotIndex * 16);
    }

    if (
      this.writeBufferIfChanged(
        this.shadowMatsBuf,
        shadowMats,
        this.lastShadowMats,
        this.shadowMatsBufferDirty,
      )
    ) {
      this.shadowMatsBufferDirty = false;
    }
  }

  private writeVsmShadowSlotParams(slots: ShadowSlot[], baseParams: Float32Array): Float32Array[] {
    for (const params of this.tempShadowSlotParamsUniforms) {
      params.set(baseParams);
      params[2] = 0;
      params[3] = 0;
    }

    for (const slot of slots) {
      const light = this.lights[slot.lightIndex];
      const params = this.tempShadowSlotParamsUniforms[slot.slotIndex];
      params.set(baseParams);

      if (light?.type === "spot") {
        const projection = getShadowProjectionDescriptor(light);
        params[2] = projection.near;
        params[3] = projection.far;
      } else {
        params[2] = 0;
        params[3] = 0;
      }
    }

    return this.tempShadowSlotParamsUniforms;
  }

  private drawShadowCasters(pass: GPURenderPassEncoder, slotIndex: number): void {
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (!obj.castShadows) continue;

      const state = this.objectDrawStates.get(i);
      const mesh = this.getMesh(obj.meshId);
      pass.setBindGroup(0, this.getShadowSlotBindGroup(state, slotIndex));
      pass.setVertexBuffer(0, mesh.vbo);
      pass.setIndexBuffer(mesh.ibo, mesh.indexFormat);
      pass.drawIndexed(mesh.indexCount);
    }
  }

  private drawVsmCasters(pass: GPURenderPassEncoder, slotIndex: number): void {
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (!obj.castShadows) continue;

      const state = this.objectDrawStates.get(i);
      const mesh = this.getMesh(obj.meshId);
      pass.setBindGroup(0, this.getVsmMomentsSlotBindGroup(state, slotIndex));
      pass.setVertexBuffer(0, mesh.vbo);
      pass.setIndexBuffer(mesh.ibo, mesh.indexFormat);
      pass.drawIndexed(mesh.indexCount);
    }
  }

  private drawDebugShadowCasters(pass: GPURenderPassEncoder, slotIndex: number): void {
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (!obj.castShadows) continue;

      const state = this.objectDrawStates.get(i);
      const mesh = this.getMesh(obj.meshId);
      pass.setBindGroup(0, this.getDebugShadowSlotBindGroup(state, slotIndex));
      pass.setVertexBuffer(0, mesh.vbo);
      pass.setIndexBuffer(mesh.ibo, mesh.indexFormat);
      pass.drawIndexed(mesh.indexCount);
    }
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
    this.objects = createDefaultObjects(this.meshRegistry.defaultMeshId);
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

  private getMesh(meshId: number) {
    return this.meshRegistry.get(meshId);
  }

  private getCurrentMainPipeline(): GPURenderPipeline {
    if (this.shadowParams.method === "PCF") return this.pipelinePCF;
    if (this.shadowParams.method === "PCSS") return this.pipelinePCSS;
    if (this.shadowParams.method === "VSM") return this.pipelineVSM;
    return this.pipelineSM;
  }

  private ensureObjectDrawStates() {
    this.objectDrawStates.ensure({
      device: this.gpu.device,
      objectCount: this.objects.length,
      method: this.shadowParams.method,
      maxShadowSlots: MAX_SHADOW_SLOTS,
      shadowMatsBuf: this.shadowMatsBuf,
      pipelines: {
        mainPipeline: this.getCurrentMainPipeline(),
        shadowPipeline: this.shadowPipeline,
        vsmMomentsPipeline: this.vsmMomentsPipeline,
        debugShadowDepthPipeline: this.debugShadowDepthPipeline,
      },
    });
  }

  private rayAabbHit(rayOrigin: vec3, rayDir: vec3, min: vec3, max: vec3): number {
    let tMin = Number.NEGATIVE_INFINITY;
    let tMax = Number.POSITIVE_INFINITY;

    for (let axis = 0; axis < 3; axis++) {
      const origin = rayOrigin[axis];
      const direction = rayDir[axis];
      if (Math.abs(direction) < 1e-6) {
        if (origin < min[axis] || origin > max[axis]) return Number.POSITIVE_INFINITY;
        continue;
      }

      let t1 = (min[axis] - origin) / direction;
      let t2 = (max[axis] - origin) / direction;
      if (t1 > t2) {
        const temp = t1;
        t1 = t2;
        t2 = temp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return Number.POSITIVE_INFINITY;
    }

    if (tMax < 0) return Number.POSITIVE_INFINITY;
    return tMin >= 0 ? tMin : tMax;
  }

  private rayObjectHit(rayOrigin: vec3, rayDir: vec3, object: SceneObject): number {
    if (object.meshId === 2) {
      const radius = 1.15 * Math.max(object.scale[0], object.scale[1], object.scale[2]);
      return raySphereHit(rayOrigin, rayDir, object.pos, radius);
    }

    const min = vec3.fromValues(
      object.pos[0] - Math.abs(object.scale[0]),
      object.pos[1] - Math.abs(object.scale[1]),
      object.pos[2] - Math.abs(object.scale[2]),
    );
    const max = vec3.fromValues(
      object.pos[0] + Math.abs(object.scale[0]),
      object.pos[1] + Math.abs(object.scale[1]),
      object.pos[2] + Math.abs(object.scale[2]),
    );
    return this.rayAabbHit(rayOrigin, rayDir, min, max);
  }

  private raySpotBeamHit(rayOrigin: vec3, rayDir: vec3, light: LightDef): number {
    if (light.type !== "spot") return Number.POSITIVE_INFINITY;

    const beamDir = vec3.fromValues(
      Math.cos(light.pitch) * Math.sin(light.yaw),
      Math.sin(light.pitch),
      Math.cos(light.pitch) * Math.cos(light.yaw),
    );
    vec3.normalize(beamDir, beamDir);

    const beamLength = Math.max(3, Math.min(24, light.range || 12));
    const beamEnd = vec3.scaleAndAdd(vec3.create(), light.pos, beamDir, beamLength);
    const segment = vec3.subtract(vec3.create(), beamEnd, light.pos);
    const rayToSegmentStart = vec3.subtract(vec3.create(), rayOrigin, light.pos);
    const segmentLenSq = vec3.squaredLength(segment);
    if (segmentLenSq < 1e-6) return Number.POSITIVE_INFINITY;

    const rayDirDotSegment = vec3.dot(rayDir, segment);
    const rayDirDotStart = vec3.dot(rayDir, rayToSegmentStart);
    const segmentDotStart = vec3.dot(segment, rayToSegmentStart);
    const denom = segmentLenSq - rayDirDotSegment * rayDirDotSegment;

    let segmentT = 0;
    if (Math.abs(denom) > 1e-6) {
      segmentT = (rayDirDotSegment * rayDirDotStart - segmentDotStart) / denom;
      segmentT = Math.max(0, Math.min(1, segmentT));
    }

    const closestOnSegment = vec3.scaleAndAdd(vec3.create(), light.pos, segment, segmentT);
    const rayT = vec3.dot(vec3.subtract(vec3.create(), closestOnSegment, rayOrigin), rayDir);
    if (rayT < 0) return Number.POSITIVE_INFINITY;

    const closestOnRay = vec3.scaleAndAdd(vec3.create(), rayOrigin, rayDir, rayT);
    const distance = vec3.distance(closestOnRay, closestOnSegment);
    const coneDistance = beamLength * segmentT;
    const coneRadius = Math.tan((Math.max(1, Math.min(78, light.outerConeDeg)) * Math.PI) / 180) * coneDistance;
    const pickRadius = Math.max(0.45, Math.min(2.4, coneRadius + beamLength * 0.04));
    return distance <= pickRadius ? rayT : Number.POSITIVE_INFINITY;
  }

  private normalizeObjectKeyboardKey(event: KeyboardEvent): string | null {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      return event.key;
    }
    if (event.code === "Space") return "Space";
    if (event.key === "Shift") return "Shift";
    return null;
  }

  private shouldCaptureObjectKeyboard(event: KeyboardEvent): boolean {
    if ((this.selection !== "object" && this.selection !== "light") || this.cameraController.isLocked()) return false;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('[data-ui-panel="true"]')) {
      return false;
    }
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
    ) {
      return false;
    }
    return this.normalizeObjectKeyboardKey(event) !== null;
  }

  private applySelectedEntityKeyboardMovement(deltaTime: number): boolean {
    if (
      (this.selection !== "object" && this.selection !== "light") ||
      this.cameraController.isLocked() ||
      this.objectKeyboardKeys.size === 0
    ) {
      return false;
    }

    const move = vec3.create();
    if (this.objectKeyboardKeys.has("ArrowLeft")) move[0] -= 1;
    if (this.objectKeyboardKeys.has("ArrowRight")) move[0] += 1;
    if (this.objectKeyboardKeys.has("ArrowUp")) move[2] -= 1;
    if (this.objectKeyboardKeys.has("ArrowDown")) move[2] += 1;
    if (this.objectKeyboardKeys.has("Space")) move[1] += 1;
    if (this.objectKeyboardKeys.has("Shift")) move[1] -= 1;

    if (vec3.length(move) < 1e-5) return true;

    vec3.normalize(move, move);

    if (this.selection === "object") {
      const obj = this.objects[this.activeObjectIndex];
      if (!obj) return false;
      vec3.scaleAndAdd(obj.pos, obj.pos, move, this.objectMoveSpeed * 2.5 * deltaTime);
      vec3.copy(this.objectPos, obj.pos);
    } else {
      const light = this.lights[this.activeLightIndex];
      if (!light) return false;
      vec3.scaleAndAdd(light.pos, light.pos, move, 4.0 * deltaTime);
      vec3.copy(this.lightDir, light.pos);
      this.lightBeamDirty = true;
      this.markLightDataDirty();
      this.updateLightViewProj();
    }

    return true;
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
    // Object params are written into per-object buffers before every frame.
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

  private get shadowView(): GPUTextureView {
    return this.shadowRenderer.shadowView;
  }

  private get shadowLayerViews(): GPUTextureView[] {
    return this.shadowRenderer.shadowLayerViews;
  }

  private get shadowSampler(): GPUSampler {
    return this.shadowRenderer.shadowSampler;
  }

  private get shadowDebugViews(): GPUTextureView[] {
    return this.shadowRenderer.shadowDebugViews;
  }

  private get vsmBlurView(): GPUTextureView {
    return this.shadowRenderer.vsmBlurView;
  }

  private get vsmSampler(): GPUSampler {
    return this.shadowRenderer.vsmSampler;
  }

  async init() {
    this.gpu = await initWebGPU(this.canvas);
    this.watchDeviceLost(this.gpu.device);
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

        if (this.selection === "light" && this.lightMode === "spot") {
          const previousLightIndex = this.activeLightIndex;
          const picked = this.handleSelectionClick(e.clientX, e.clientY);
          if (picked !== "light" || this.activeLightIndex !== previousLightIndex) {
            return;
          }

          // Повторный drag по уже выбранной сфере spot light вращает прожектор.
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

    window.addEventListener("keydown", (e) => {
      if (!this.shouldCaptureObjectKeyboard(e)) return;
      const key = this.normalizeObjectKeyboardKey(e);
      if (!key) return;
      this.objectKeyboardKeys.add(key);
      e.preventDefault();
    });

    window.addEventListener("keyup", (e) => {
      const key = this.normalizeObjectKeyboardKey(e);
      if (!key) return;
      this.objectKeyboardKeys.delete(key);
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

  setPerformanceCallback(callback: (metrics: PerformanceMetrics) => void) {
    this.performanceCallback = callback;
  }

  setFpsCallback(callback: (fps: number) => void) {
    this.setPerformanceCallback((metrics) => callback(metrics.fps));
  }

  resetPerformanceMetrics() {
    const now = performance.now();
    this.frameCount = 0;
    this.totalFrameCount = 0;
    this.lastFpsUpdate = now;
    this.lastFrameTime = now;
    this.performanceStartTime = now;
    this.currentFps = 0;
    this.currentFrameTimeMs = 0;
    this.frameTimeHistory = [];
    this.fpsSampleHistory = [];
    this.sessionMinFps = Number.POSITIVE_INFINITY;
    this.sessionMaxFps = 0;
    this.sessionFrameTimeSumMs = 0;
    this.sessionFrameCount = 0;
    this.sessionMaxFrameTimeMs = 0;
    this.lastFpsSampleDurationMs = 0;
    this.performanceCallback?.(this.getPerformanceMetrics());
  }

  private handleSelectionClick(clientX: number, clientY: number): Selection {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;

    const invViewProj = mat4.invert(mat4.create(), this.viewProj);
    if (!invViewProj) return "none";

    const nearPoint = vec3.fromValues(x, y, -1);
    const farPoint = vec3.fromValues(x, y, 1);

    const worldNear = vec3.transformMat4(vec3.create(), nearPoint, invViewProj);
    const worldFar = vec3.transformMat4(vec3.create(), farPoint, invViewProj);

    const rayDir = vec3.subtract(vec3.create(), worldFar, worldNear);
    vec3.normalize(rayDir, rayDir);
    const rayOrigin = this.cameraController.getCameraPosition();

    // Поиск ближайшего объекта
    let bestObjT = Number.POSITIVE_INFINITY;
    let bestObjIndex = -1;

    for (let i = 0; i < this.objects.length; i++) {
      const object = this.objects[i];
      const t = this.rayObjectHit(rayOrigin, rayDir, object);
      if (t < bestObjT) {
        bestObjT = t;
        bestObjIndex = i;
      }
    }

    // Поиск ближайшего источника света
    const lightRadius = 0.55;
    let bestLightT = Number.POSITIVE_INFINITY;
    let bestLightIndex = -1;

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const center = light.pos;
      const t = raySphereHit(rayOrigin, rayDir, center, lightRadius);
      const beamT = this.raySpotBeamHit(rayOrigin, rayDir, light);
      const pickT = Math.min(t, beamT);
      if (pickT < bestLightT) {
        bestLightT = pickT;
        bestLightIndex = i;
      }
    }

    const hasObj = bestObjIndex !== -1;
    const hasLight = bestLightIndex !== -1;

    if (!hasObj && !hasLight) {
      this.setSelection("none");
      return "none";
    }

    if (hasObj && hasLight) {
      // Берём то, что ближе по лучу
      if (bestLightT < bestObjT) {
        this.setActiveLight(bestLightIndex);
        this.setSelection("light");
        return "light";
      } else {
        this.activeObjectIndex = bestObjIndex;
        const obj = this.objects[this.activeObjectIndex];
        vec3.copy(this.objectPos, obj.pos);
        this.setSelection("object");
        return "object";
      }
    }

    if (hasLight) {
      this.setActiveLight(bestLightIndex);
      this.setSelection("light");
      return "light";
    }

    if (hasObj) {
      this.activeObjectIndex = bestObjIndex;
      const obj = this.objects[this.activeObjectIndex];
      vec3.copy(this.objectPos, obj.pos);
      this.setSelection("object");
      return "object";
    }

    return "none";
  }

  private pickAxisHit(clientX: number, clientY: number): number {
    const axisLength = 2.2;
    const pickThresholdPx = 14;

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
    if (sel !== "object" && sel !== "light") {
      this.objectKeyboardKeys.clear();
      this.cameraController.setOrbitKeyboardSuppressed(false);
    } else {
      this.cameraController.setOrbitKeyboardSuppressed(true);
    }

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
    this.shadowRenderer.createShadowResources(this.gpu.device, this.shadowSize, MAX_SHADOW_SLOTS);
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
    this.blurVerticalPipeline = pipelines.blurVerticalPipeline;
    this.shadowPipeline = pipelines.shadowPipeline;
    this.gridPipeline = pipelines.gridPipeline;
    this.lightBeamPipeline = pipelines.lightBeamPipeline;
    this.axisPipeline = pipelines.axisPipeline;
    this.debugShadowDepthPipeline = pipelines.debugShadowDepthPipeline;
    this.debugVsmPipeline = pipelines.debugVsmPipeline;
  }

  private createVSMResources() {
    this.shadowRenderer.createVSMResources(this.gpu.device, this.shadowSize, MAX_SHADOW_SLOTS);
    console.log("✓ VSM resources created");
  }

  private createGeometry() {
    this.meshRegistry.createDefaultMeshes(this.gpu.device);
  }

  private createGrid() {
    this.gridVBO?.destroy();
    this.gridNBO?.destroy();
    this.gridTBO?.destroy();

    const grid = createGridGeometry(this.floorSize);
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
    this.wallVBO?.destroy();
    this.wallNBO?.destroy();
    this.wallTBO?.destroy();

    const walls = createWallsGeometry(this.floorSize);
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
    this.shadowMatsBuf = buffers.shadowMatsBuf;
    this.lightsBuf = buffers.lightsBuf;
    this.shadingBufferDirty = true;
    this.shadowMatsBufferDirty = true;
    this.gridParamsBufferDirty = true;
    this.lightsBufferDirty = true;
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

    if (this.shadowParams.method === "VSM") {
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.vsmBlurView },
          { binding: 1, resource: this.vsmSampler },
          { binding: 2, resource: this.shadowRenderer.vsmMomentsView },
        ],
      });
    } else if (
      this.shadowParams.method === "SM" ||
      this.shadowParams.method === "PCF" ||
      this.shadowParams.method === "PCSS"
    ) {
      // SM/PCF/PCSS: одна depth texture array, layer выбирается через light.shadowIndex.
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler },
        ],
      });
    } else {
      this.bindGroup1Main = device.createBindGroup({
        layout: currentPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: this.shadowView },
          { binding: 1, resource: this.shadowSampler },
        ],
      });
    }

    this.vsmBlurBindGroups = this.shadowRenderer.createVsmBlurBindGroups(
      device,
      this.blurHorizontalPipeline,
      this.blurVerticalPipeline,
    );
    this.debugShadowBindGroups = this.shadowRenderer.createDebugShadowBindGroups(
      device,
      this.debugVsmPipeline,
    );
    this.debugVsmBindGroups = this.shadowRenderer.createDebugVsmBindGroups(
      device,
      this.debugVsmPipeline,
      MAX_SHADOW_SLOTS,
    );

    this.objectDrawStates.destroy();

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
        { binding: 2, resource: this.vsmBlurView },
        { binding: 3, resource: this.vsmSampler },
        { binding: 4, resource: this.shadowRenderer.vsmMomentsView },
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

    const up = getStableShadowUp(pos, this.tempLightUp, this.tempLightDirNorm);
    const target = getShadowTargetForLight(main, this.tempLightBeamEnd, this.tempLightBeamDir);
    mat4.lookAt(this.tempLightView, pos, target, up);
    this.writeLightProjection(main, this.tempLightProj);

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
    const up = getStableShadowUp(l.pos, this.tempLightUp, this.tempLightDirNorm);
    const target = getShadowTargetForLight(l, this.tempLightBeamEnd, this.tempLightBeamDir);
    mat4.lookAt(this.tempLightView, l.pos, target, up);
    this.writeLightProjection(l, this.tempLightProj);

    mat4.multiply(out, this.tempLightProj, this.tempLightView);
    return out;
  }

  private writeLightProjection(light: LightDef | undefined, out: mat4) {
    const descriptor = getShadowProjectionDescriptor(light);
    if (descriptor.type === "perspective") {
      perspectiveZO(out, descriptor.fovY, descriptor.aspect, descriptor.near, descriptor.far);
      return;
    }

    orthoZO(
      out,
      -descriptor.size,
      descriptor.size,
      -descriptor.size,
      descriptor.size,
      descriptor.near,
      descriptor.far,
    );
  }

  private pointSpotLightAtSceneTarget(light: LightDef) {
    const target = this.objectPos;
    const dir = vec3.subtract(this.tempLightBeamDir, target, light.pos);
    const len = vec3.length(dir);
    if (len < 0.001) {
      light.yaw = 0;
      light.pitch = -Math.PI / 4;
      return;
    }

    vec3.scale(dir, dir, 1 / len);
    light.yaw = Math.atan2(dir[0], dir[2]);
    light.pitch = Math.asin(Math.max(-0.99, Math.min(0.99, dir[1])));
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
    return this.meshRegistry.getMeta();
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
    const diagnostics = this.getActiveLightDiagnostics();
    if (!active) {
      return {
        mode: this.lightMode,
        intensity: this.lightIntensity,
        position: vec3.clone(this.lightDir),
        color: [1, 1, 1] as [number, number, number],
        castShadows: true,
        innerConeDeg: 15,
        outerConeDeg: 28,
        range: 12,
        falloff: 1.5,
        diagnostics,
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
      innerConeDeg: active.innerConeDeg,
      outerConeDeg: active.outerConeDeg,
      range: active.range,
      falloff: active.falloff,
      diagnostics,
    };
  }

  getActiveLightDiagnostics() {
    const active = this.lights[this.activeLightIndex];
    const shadowSlot = getShadowSlotLabels(this.lights.length, this.getMaxShadowSlotsForMethod())[this.activeLightIndex] ?? null;
    const method = this.shadowParams.method;
    const isSpot = active?.type === "spot";
    const projection = active ? getShadowProjectionDescriptor(active) : null;
    const shadowProjection: "perspective" | "orthographic" | "none" = projection?.type ?? "none";

    return {
      shadowSlot,
      castsShadow: active?.castShadows ?? false,
      shadowProjection,
      shadowFar: projection?.far ?? null,
      effectiveBias: method === "VSM"
        ? this.shadowParams.vsmMinVariance
        : this.shadowParams.bias * (isSpot ? 0.08 : 1),
      cone: isSpot ? [active.innerConeDeg, active.outerConeDeg] as [number, number] : null,
      range: isSpot ? active.range : null,
      falloff: isSpot ? active.falloff : null,
      shadowOrthoSize: projection?.shadowOrthoSize ?? null,
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
    if (this.deviceLost) return;
    const now = performance.now();
    this.lastFrameTime = now;
    this.lastFpsUpdate = now;
    this.performanceStartTime = now;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  private watchDeviceLost(device: GPUDevice) {
    device.lost.then((info) => {
      this.deviceLost = true;
      this.stop();

      const reason = info.reason ? ` (${info.reason})` : "";
      const details = info.message ? `: ${info.message}` : "";
      const message = `WebGPU device lost${reason}${details}`;
      console.warn(message);
      this.deviceLostHandler?.(message);
    });
  }

  destroy() {
    this.stop();
    if (this.depthTex) this.depthTex.destroy();
    this.shadowRenderer.destroy();
    this.meshRegistry.destroy();
    if (this.uniformBuf) this.uniformBuf.destroy();
    if (this.axisVBO) this.axisVBO.destroy();
    if (this.axisIBO) this.axisIBO.destroy();
    if (this.axisUniformBuf) this.axisUniformBuf.destroy();
    if (this.shadingBuf) this.shadingBuf.destroy();
    if (this.gridTBO) this.gridTBO.destroy();
    if (this.gridParamsBuf) this.gridParamsBuf.destroy();
    if (this.wallVBO) this.wallVBO.destroy();
    if (this.wallNBO) this.wallNBO.destroy();
    if (this.wallTBO) this.wallTBO.destroy();
    if (this.lightBeamVBO) this.lightBeamVBO.destroy();
    if (this.lightBeamIBO) this.lightBeamIBO.destroy();
    if (this.lightsBuf) this.lightsBuf.destroy();
    if (this.shadowMatsBuf) this.shadowMatsBuf.destroy();
    this.objectDrawStates.destroy();

    console.log("✓ Renderer destroyed");
  }

  private getObjectsRotationCenter(out: vec3): vec3 | null {
    if (this.objects.length === 0) return null;

    vec3.set(out, 0, 0, 0);
    for (const object of this.objects) {
      vec3.add(out, out, object.pos);
    }
    vec3.scale(out, out, 1 / this.objects.length);
    return out;
  }

  private frame() {
    if (this.deviceLost) return;
    const { device, context } = this.gpu;

    this.frameCount++;
    this.totalFrameCount++;
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000;
    this.currentFrameTimeMs = deltaTime * 1000;
    this.lastFrameTime = now;
    this.sessionFrameTimeSumMs += this.currentFrameTimeMs;
    this.sessionFrameCount++;
    this.sessionMaxFrameTimeMs = Math.max(this.sessionMaxFrameTimeMs, this.currentFrameTimeMs);
    this.frameTimeHistory.push(this.currentFrameTimeMs);
    if (this.frameTimeHistory.length > 120) {
      this.frameTimeHistory.shift();
    }

    if (now - this.lastFpsUpdate > 500) {
      this.lastFpsSampleDurationMs = now - this.lastFpsUpdate;
      const fpsSample = (this.frameCount * 1000) / this.lastFpsSampleDurationMs;
      this.currentFps = Math.round(fpsSample);
      this.fpsSampleHistory.push(fpsSample);
      if (this.fpsSampleHistory.length > 120) {
        this.fpsSampleHistory.shift();
      }
      this.sessionMinFps = Math.min(this.sessionMinFps, fpsSample);
      this.sessionMaxFps = Math.max(this.sessionMaxFps, fpsSample);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      if (this.performanceCallback) {
        this.performanceCallback(this.getPerformanceMetrics());
      }
    }

    const lightModeIndex = this.getLightModeIndex();
    const methodIndex = this.getMethodIndex();

    const casters = this.getShadowCasters(this.getMaxShadowSlotsForMethod());
    const caster0 = casters.length > 0 ? casters[0] : -1;
    const caster1 = casters.length > 1 ? casters[1] : -1;
    const shadowSlots = this.buildShadowSlots(casters);

    if (
      caster0 !== this.cachedShadowCaster0 ||
      caster1 !== this.cachedShadowCaster1
    ) {
      this.cachedShadowCaster0 = caster0;
      this.cachedShadowCaster1 = caster1;
      this.shadingBufferDirty = true;
      this.lightsBufferDirty = true;
      this.shadowMatsBufferDirty = true;
    }

    if (this.shadingBufferDirty) {
      const shadingData = this.tempShadingData;
      const sky = this.shadowParams.hemisphereSkyColor ?? [0.62, 0.68, 0.78];
      const ground = this.shadowParams.hemisphereGroundColor ?? [0.18, 0.16, 0.14];
      writeShadingParamsToBuffer(shadingData, {
        shadowStrength: this.shadowStrength,
        lightModeIndex,
        spotYaw: this.spotYaw,
        spotPitch: this.spotPitch,
        methodIndex,
        lightIntensity: this.lightIntensity,
        shadowCaster0: caster0,
        shadowCaster1: caster1,
        ambientStrength: this.shadowParams.ambientStrength ?? 0.4,
        exposure: this.shadowParams.exposure ?? 0.9,
        lightDebugMode: this.getLightDebugModeIndex(),
        activeLightIndex: this.activeLightIndex,
        skyAmbient: sky,
        groundAmbient: ground,
      });
      device.queue.writeBuffer(this.shadingBuf, 0, shadingData);
      this.lastShadingData.set(shadingData);
      this.shadingBufferDirty = false;
    }

    this.writeShadowMatrices(shadowSlots);

    if (this.gridParamsBufferDirty) {
      const gridParams = this.tempGridParams;
      gridParams[0] = this.floorColor[0];
      gridParams[1] = this.floorColor[1];
      gridParams[2] = this.floorColor[2];
      gridParams[4] = this.wallColor[0];
      gridParams[5] = this.wallColor[1];
      gridParams[6] = this.wallColor[2];
      gridParams[8] = this.floorSize;
      gridParams[9] = this.showGrid ? 1 : 0;
      device.queue.writeBuffer(this.gridParamsBuf, 0, gridParams);
      this.lastGridParams.set(gridParams);
      this.gridParamsBufferDirty = false;
    }

    if (this.lightsBufferDirty) {
      const lightsData = this.tempLightsData;
      lightsData.fill(0);

      const count = Math.min(this.lights.length || 1, MAX_LIGHTS);
      lightsData[0] = count;

      for (let i = 0; i < count; i++) {
        const l = this.lights[i];
        writeLightToBuffer(lightsData, i, l, casters.indexOf(i), {
          pos: this.lightDir,
          type: this.lightMode,
          yaw: this.spotYaw,
          pitch: this.spotPitch,
          intensity: this.lightIntensity,
        });
      }

      device.queue.writeBuffer(this.lightsBuf, 0, lightsData);
      this.lastLightsData.set(lightsData);
      this.lightsBufferDirty = false;
    }

    const activeObj = this.objects[this.activeObjectIndex];
    if (activeObj) {
      vec3.copy(this.objectPos, activeObj.pos);
    }
    const objectKeyboardActive = this.applySelectedEntityKeyboardMovement(deltaTime);
    this.cameraController.setOrbitKeyboardSuppressed(objectKeyboardActive);
    this.cameraController.update(deltaTime);
    this.updateViewProj();

    // Если тащим объект или авто‑вращение выключено — не крутим его
    const arcballDelta =
      this.isDraggingObject || !this.objectAutoRotate ? 0 : deltaTime;
    const rotation = this.arcball.update(arcballDelta);
    const rotationCenter = this.sharedRotationCenter
      ? this.getObjectsRotationCenter(this.tempSharedRotationCenter)
      : null;

    // Собираем модельную матрицу = Translation(objectPos) * Rotation
    if (rotationCenter) {
      vec3.subtract(this.tempActiveRotationOffset, this.objectPos, rotationCenter);
      mat4.fromTranslation(this.model, rotationCenter);
      mat4.multiply(this.model, this.model, rotation);
      mat4.translate(this.model, this.model, this.tempActiveRotationOffset);
    } else {
      mat4.fromTranslation(this.model, this.objectPos);
      mat4.multiply(this.model, this.model, rotation);
    }

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

    this.ensureObjectDrawStates();
    this.objectUniformWriter.writeObjects(device, this.objects, this.objectDrawStates, {
      viewProj: this.viewProj,
      lightViewProjs: this.tempLightViewProjs,
      lightPos,
      camPos,
      lightSelected: this.lightSelected,
      shadowParamsUniform,
      shadowSlotParamsUniforms: this.shadowParams.method === "VSM"
        ? this.writeVsmShadowSlotParams(shadowSlots, shadowParamsUniform)
        : undefined,
      rotation,
      sharedRotationCenter: rotationCenter,
      maxShadowSlots: MAX_SHADOW_SLOTS,
    });

    const encoder = device.createCommandEncoder();
    const debugShadowSlotIndex = this.getDebugShadowSlotIndex();

    // Shadow pass
    if (this.shadowParams.method === "VSM") {
      this.shadowRenderer.renderVsmSlots({
        device,
        encoder,
        slots: shadowSlots,
        vsmMomentsPipeline: this.vsmMomentsPipeline,
        blurHorizontalPipeline: this.blurHorizontalPipeline,
        blurVerticalPipeline: this.blurVerticalPipeline,
        vsmBlurBindGroups: this.vsmBlurBindGroups,
        shadowSize: this.shadowSize,
        layerCount: MAX_SHADOW_SLOTS,
        debugShadowSlotIndex,
        drawVsmCasters: (pass, slotIndex) => this.drawVsmCasters(pass, slotIndex),
      });
    } else {
      this.shadowRenderer.renderDepthSlots({
        encoder,
        slots: shadowSlots,
        shadowPipeline: this.shadowPipeline,
        debugShadowDepthPipeline: this.debugShadowDepthPipeline,
        debugShadowSlotIndex,
        drawShadowCasters: (pass, slotIndex) => this.drawShadowCasters(pass, slotIndex),
        drawDebugShadowCasters: (pass, slotIndex) => this.drawDebugShadowCasters(pass, slotIndex),
      });
    }

    // Scene pass: main objects, floor/walls, light beam and axis gizmo share color/depth attachments.
    const frameView = context.getCurrentTexture().createView();
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: frameView,
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
    this.drawSceneObjects(scenePass, this.getCurrentObjectPipeline());
    this.drawEnvironment(scenePass);
    this.drawEditorOverlays(scenePass);

    scenePass.end();

    this.renderShadowDebugOverlay(encoder, frameView);

    device.queue.submit([encoder.finish()]);
  }

  private drawSceneObjects(scenePass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
    scenePass.setPipeline(pipeline);
    scenePass.setBindGroup(1, this.bindGroup1Main);
    scenePass.setBindGroup(2, this.objTexBindGroup);

    if (this.shadingBindGroupMain) {
      scenePass.setBindGroup(3, this.shadingBindGroupMain);
    }

    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      const state = this.objectDrawStates.get(i);
      const mesh = this.getMesh(obj.meshId);
      scenePass.setBindGroup(0, state.mainBindGroup);
      scenePass.setVertexBuffer(0, mesh.vbo);
      scenePass.setVertexBuffer(1, mesh.nbo);
      scenePass.setVertexBuffer(2, mesh.tbo);
      scenePass.setIndexBuffer(mesh.ibo, mesh.indexFormat);
      scenePass.drawIndexed(mesh.indexCount);
    }
  }

  private getCurrentObjectPipeline(): GPURenderPipeline {
    if (this.shadowParams.method === "PCF") return this.pipelinePCF;
    if (this.shadowParams.method === "PCSS") return this.pipelinePCSS;
    if (this.shadowParams.method === "VSM") return this.pipelineVSM;
    return this.pipelineSM;
  }

  private drawEnvironment(scenePass: GPURenderPassEncoder): void {
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
  }

  private drawEditorOverlays(scenePass: GPURenderPassEncoder): void {
    if (this.showLightBeam && this.selection === "light") {
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
  }

  private renderShadowDebugOverlay(encoder: GPUCommandEncoder, frameView: GPUTextureView) {
    const debugShadowSlotIndex = this.getDebugShadowSlotIndex();
    if (debugShadowSlotIndex === null) return;

    const isVsm = this.shadowParams.method === "VSM";
    const bindGroup = isVsm
      ? this.debugVsmBindGroups[debugShadowSlotIndex]
      : this.debugShadowBindGroups[debugShadowSlotIndex];
    if (!bindGroup) return;

    const rect = this.canvas.getBoundingClientRect();
    const dprX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const dprY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    const previewCssSize = Math.min(220, Math.floor(Math.min(rect.width, rect.height) * 0.26));
    const marginCss = 16;
    const sidePanelCssWidth = 340;
    const previewWidth = Math.floor(previewCssSize * dprX);
    const previewHeight = Math.floor(previewCssSize * dprY);
    const rightMargin = Math.floor((sidePanelCssWidth + marginCss) * dprX);
    const x = Math.max(
      Math.floor(marginCss * dprX),
      this.canvas.width - previewWidth - rightMargin,
    );
    const y = Math.floor(marginCss * dprY);

    const debugPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: frameView,
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    debugPass.setViewport(x, y, previewWidth, previewHeight, 0, 1);
    debugPass.setScissorRect(x, y, previewWidth, previewHeight);
    debugPass.setPipeline(this.debugVsmPipeline);
    debugPass.setBindGroup(0, bindGroup);
    debugPass.draw(3);
    debugPass.end();
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const history = this.frameTimeHistory.slice();
    const recentFpsSamples = this.fpsSampleHistory.length ? this.fpsSampleHistory : [this.currentFps];
    const elapsedMs = Math.max(0, performance.now() - this.performanceStartTime);
    const averageFps = elapsedMs > 0 ? (this.totalFrameCount * 1000) / elapsedMs : 0;
    const averageFrameTimeMs =
      this.sessionFrameCount > 0 ? this.sessionFrameTimeSumMs / this.sessionFrameCount : 0;

    return {
      fps: this.currentFps,
      averageFps: Math.round(averageFps),
      recentMinFps: Math.round(Math.min(...recentFpsSamples)),
      recentMaxFps: Math.round(Math.max(...recentFpsSamples)),
      sessionMinFps: Number.isFinite(this.sessionMinFps) ? Math.round(this.sessionMinFps) : 0,
      sessionMaxFps: Math.round(this.sessionMaxFps),
      frameTimeMs: this.currentFrameTimeMs,
      averageFrameTimeMs,
      maxFrameTimeMs: this.sessionMaxFrameTimeMs,
      frameTimeHistory: history,
      sampleDurationMs: this.lastFpsSampleDurationMs,
    };
  }

  private getLightDebugModeIndex() {
    const mode = this.shadowParams.lightDebugMode ?? "final";
    if (mode === "lighting") return 1;
    if (mode === "diffuse") return 2;
    if (mode === "specular") return 3;
    if (mode === "shadow") return 4;
    if (mode === "normals") return 5;
    if (mode === "activeCone") return 6;
    if (mode === "activeFalloff") return 7;
    if (mode === "activeShadow") return 8;
    return 0;
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
    ambientStrength?: number;
    exposure?: number;
    hemisphereSkyColor?: [number, number, number];
    hemisphereGroundColor?: [number, number, number];
    lightDebugMode?: LightDebugMode;
    debugShadowMap?: ShadowDebugMode;
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
      ambientStrength:
        params.ambientStrength ?? this.shadowParams.ambientStrength,
      exposure: params.exposure ?? this.shadowParams.exposure,
      hemisphereSkyColor:
        params.hemisphereSkyColor ?? this.shadowParams.hemisphereSkyColor,
      hemisphereGroundColor:
        params.hemisphereGroundColor ?? this.shadowParams.hemisphereGroundColor,
      lightDebugMode:
        params.lightDebugMode ?? this.shadowParams.lightDebugMode,
      debugShadowMap: params.debugShadowMap ?? this.shadowParams.debugShadowMap,
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

    if (methodChanged) {
      this.shadowMatsBufferDirty = true;
      this.updateLightViewProj();
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
    this.floorSize = 10;
    this.showGrid = true;
    this.createGrid();
    this.createWalls();
    this.markGridParamsDirty();

    // Сбрасываем вращение объекта
    this.arcball.reset();

    // Сбрасываем позицию объекта и выделение
    vec3.set(this.objectPos, 0, 0, 0);
    this.selection = "none";
    this.objectKeyboardKeys.clear();
    this.cameraController.setOrbitKeyboardSuppressed(false);
    this.isDraggingObject = false;
    this.isDraggingLight = false;
    this.dragAxisIndex = -1;
    this.canvas.style.cursor = "default";

    console.log(
      "✓ Scene reset to defaults (camera/light/object/light/shadows)",
    );
  }

  applyLightingPreset() {
    this.cameraController.reset();
    this.updateViewProj();

    this.objects = [
      createSceneObject({
        id: 0,
        objectPos: vec3.fromValues(-2.2, 0, 0),
        objectMoveSpeed: this.objectMoveSpeed,
        defaultMeshId: this.meshRegistry.defaultMeshId,
        def: {
          pos: vec3.fromValues(-2.2, 0, 0),
          meshId: 1,
          color: vec3.fromValues(0.95, 0.95, 0.9),
          castShadows: true,
          receiveShadows: false,
          selfShadows: false,
          specular: 0.5,
          roughness: 0.38,
          shininess: 4 + (1 - 0.38) * 124,
        },
      }),
      createSceneObject({
        id: 1,
        objectPos: vec3.fromValues(1.8, 0, 0.4),
        objectMoveSpeed: this.objectMoveSpeed,
        defaultMeshId: this.meshRegistry.defaultMeshId,
        def: {
          pos: vec3.fromValues(1.8, 0, 0.4),
          meshId: 2,
          color: vec3.fromValues(0.75, 0.82, 1.0),
          castShadows: true,
          receiveShadows: false,
          selfShadows: false,
          specular: 0.75,
          roughness: 0.22,
          shininess: 4 + (1 - 0.22) * 124,
        },
      }),
    ];
    this.activeObjectIndex = 0;
    vec3.copy(this.objectPos, this.objects[0].pos);

    this.lights = [
      createLight({
        objectPos: this.objectPos,
        def: {
          pos: vec3.fromValues(5.5, 6.5, 4),
          type: "spot",
          yaw: -2.35,
          pitch: -0.7,
          intensity: 1.35,
          color: vec3.fromValues(1.0, 0.74, 0.58),
          castShadows: true,
          innerConeDeg: 18,
          outerConeDeg: 36,
          range: 16,
          falloff: 1.3,
        },
      }),
      createLight({
        objectPos: this.objectPos,
        def: {
          pos: vec3.fromValues(-5, 5.4, -3.5),
          type: "spot",
          yaw: 0.78,
          pitch: -0.55,
          intensity: 1.05,
          color: vec3.fromValues(0.48, 0.66, 1.0),
          castShadows: true,
          innerConeDeg: 20,
          outerConeDeg: 42,
          range: 15,
          falloff: 1.6,
        },
      }),
      createLight({
        objectPos: this.objectPos,
        def: {
          pos: vec3.fromValues(0, 8, 0),
          type: "top",
          intensity: 0.35,
          color: vec3.fromValues(0.9, 1.0, 0.88),
          castShadows: false,
        },
      }),
    ];
    this.activeLightIndex = 0;
    const main = this.lights[0];
    this.lightMode = main.type;
    this.lightIntensity = main.intensity;
    vec3.copy(this.lightDir, main.pos);
    this.spotYaw = main.yaw;
    this.spotPitch = main.pitch;

    this.shadowParams = {
      ...this.shadowParams,
      method: "PCF",
      shadowMapSize: 2048,
      bias: 0.003,
      pcfRadius: 2.5,
      pcfSamples: 16,
      shadowStrength: 1.0,
      ambientStrength: 0.36,
      exposure: 0.92,
      hemisphereSkyColor: [0.56, 0.62, 0.76],
      hemisphereGroundColor: [0.16, 0.14, 0.13],
      lightDebugMode: "final",
      debugShadowMap: "off",
    };
    this.shadowStrength = this.shadowParams.shadowStrength;
    this.shadowSize = this.shadowParams.shadowMapSize;
    this.createShadowResources();
    this.createVSMResources();
    this.recreateBindGroups();
    this.arcball.reset();
    this.selection = "none";
    this.objectKeyboardKeys.clear();
    this.cameraController.setOrbitKeyboardSuppressed(false);
    this.markObjectParamsDirty();
    this.markLightDataDirty();
    this.shadingBufferDirty = true;
    this.shadowMatsBufferDirty = true;
    this.uniformShadowParamsDirty = true;
    this.lightBeamDirty = true;
    this.updateLightViewProj();
  }

  applyScenePreset(presetId: ScenePresetId) {
    const preset = SCENE_PRESETS[presetId];
    if (!preset) return;

    this.cameraController.reset();
    this.updateViewProj();

    this.objects = preset.objects.map((object, index) =>
      createSceneObject({
        id: index,
        objectPos: vec3.fromValues(object.pos[0], object.pos[1], object.pos[2]),
        objectMoveSpeed: this.objectMoveSpeed,
        defaultMeshId: this.meshRegistry.defaultMeshId,
        def: {
          name: object.name ?? `Object ${index + 1}`,
          pos: vec3.fromValues(object.pos[0], object.pos[1], object.pos[2]),
          scale: vec3.fromValues(
            object.scale?.[0] ?? 1,
            object.scale?.[1] ?? 1,
            object.scale?.[2] ?? 1,
          ),
          meshId: object.meshId ?? this.meshRegistry.defaultMeshId,
          color: object.color
            ? vec3.fromValues(object.color[0], object.color[1], object.color[2])
            : vec3.fromValues(1, 1, 1),
          castShadows: object.castShadows ?? true,
          receiveShadows: object.receiveShadows ?? true,
          selfShadows: object.selfShadows ?? false,
          specular: object.specular ?? 0.4,
          roughness: object.roughness ?? 0.55,
          shininess: object.shininess ?? 4 + (1 - (object.roughness ?? 0.55)) * 124,
        },
      }),
    );

    this.activeObjectIndex = 0;
    vec3.copy(this.objectPos, this.objects[0].pos);

    this.lights = preset.lights.slice(0, MAX_LIGHTS).map((light, index) =>
      createLight({
        objectPos: this.objectPos,
        def: {
          name: light.name ?? `Light ${index + 1}`,
          pos: vec3.fromValues(light.pos[0], light.pos[1], light.pos[2]),
          type: light.type,
          yaw: light.yaw ?? 0,
          pitch: light.pitch ?? -0.65,
          intensity: light.intensity ?? 1,
          color: light.color
            ? vec3.fromValues(light.color[0], light.color[1], light.color[2])
            : vec3.fromValues(1, 1, 1),
          castShadows: light.castShadows ?? true,
          innerConeDeg: light.innerConeDeg ?? 15,
          outerConeDeg: light.outerConeDeg ?? 32,
          range: light.range ?? 14,
          falloff: light.falloff ?? 1.5,
        },
      }),
    );

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

    vec3.set(this.floorColor, preset.floorColor[0], preset.floorColor[1], preset.floorColor[2]);
    vec3.set(this.wallColor, preset.wallColor[0], preset.wallColor[1], preset.wallColor[2]);
    this.showFloor = preset.showFloor;
    this.showWalls = preset.showWalls;
    this.floorSize = preset.floorSize ?? 10;
    this.showGrid = preset.showGrid ?? true;
    this.createGrid();
    this.createWalls();

    if (preset.shadowMethod || preset.shadowParams) {
      this.updateShadowParams({
        ...this.shadowParams,
        ...preset.shadowParams,
        method: preset.shadowMethod ?? preset.shadowParams?.method ?? this.shadowParams.method,
      });
    }

    this.arcball.reset();
    this.selection = "none";
    this.objectKeyboardKeys.clear();
    this.cameraController.setOrbitKeyboardSuppressed(false);
    this.isDraggingObject = false;
    this.isDraggingLight = false;
    this.isRotatingLight = false;
    this.dragAxisIndex = -1;
    this.canvas.style.cursor = "default";

    this.markObjectParamsDirty();
    this.markLightDataDirty();
    this.markGridParamsDirty();
    this.shadingBufferDirty = true;
    this.shadowMatsBufferDirty = true;
    this.uniformShadowParamsDirty = true;
    this.lightBeamDirty = true;
    this.updateLightViewProj();
  }

  resetModel() {
    // Возвращаем дефолтную геометрию (куб)
    this.createGeometry();

    // Все объекты снова используют куб
    for (const obj of this.objects) {
      obj.meshId = this.meshRegistry.defaultMeshId;
    }
    this.markObjectParamsDirty();

    console.log("✓ Model reset to default cube");
  }

  async loadModel(file: File) {
    try {
      const mesh = await this.meshRegistry.loadModelFile(this.gpu.device, file);

      // Назначаем новую модель активному объекту
      const obj = this.objects[this.activeObjectIndex];
      if (obj) {
        obj.meshId = mesh.id;
        this.markObjectParamsDirty();
      }

      console.log(
        `✓ Loaded OBJ mesh #${mesh.id}: ${mesh.indexCount / 3} triangles`,
      );
    } catch (e) {
      console.error("Failed to load OBJ:", e);
      alert(`Ошибка загрузки модели: ${e}`);
    }
  }
}
