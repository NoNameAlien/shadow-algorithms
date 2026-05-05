import type { vec3 } from 'gl-matrix';

export type GPUCtx = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  configure: () => void;
};

export type Selection = 'none' | 'object' | 'light';
export type ShadowMethod = 'SM' | 'PCF' | 'PCSS' | 'VSM';
export type LightMode = 'sun' | 'spot' | 'top';
export type ShadowDebugMode = 'off' | 'primary' | 'secondary';
export type LightDebugMode = 'final' | 'lighting' | 'diffuse' | 'specular' | 'shadow' | 'normals';

export type PerformanceMetrics = {
  fps: number;
  averageFps: number;
  recentMinFps: number;
  recentMaxFps: number;
  sessionMinFps: number;
  sessionMaxFps: number;
  frameTimeMs: number;
  averageFrameTimeMs: number;
  maxFrameTimeMs: number;
  frameTimeHistory: number[];
  sampleDurationMs: number;
};

export type LightDef = {
  name: string;
  pos: vec3;
  type: LightMode;
  yaw: number;
  pitch: number;
  intensity: number;
  color: vec3;
  castShadows: boolean;
  innerConeDeg: number;
  outerConeDeg: number;
  range: number;
  falloff: number;
};

export type SceneObject = {
  id: number;
  name: string;
  pos: vec3;
  scale: vec3;
  moveSpeed: number;
  color: vec3;
  castShadows: boolean;
  receiveShadows: boolean;
  selfShadows: boolean;
  meshId: number;
  specular: number;
  shininess: number;
  roughness: number;
};

export type MeshDef = {
  id: number;
  name: string;
  vbo: GPUBuffer;
  nbo: GPUBuffer;
  tbo: GPUBuffer;
  ibo: GPUBuffer;
  indexCount: number;
};

export type LightDTO = {
  name?: string;
  pos: [number, number, number];
  type: LightMode;
  yaw: number;
  pitch: number;
  intensity: number;
  color: [number, number, number];
  castShadows: boolean;
  innerConeDeg?: number;
  outerConeDeg?: number;
  range?: number;
  falloff?: number;
};

export type ObjectDTO = {
  name?: string;
  pos: [number, number, number];
  scale?: [number, number, number];
  moveSpeed: number;
  color: [number, number, number];
  castShadows: boolean;
  receiveShadows: boolean;
  selfShadows?: boolean;
  meshId: number;
  specular: number;
  shininess: number;
  roughness?: number;
};

export type ShadowParamsDTO = {
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
  ambientStrength: number;
  exposure: number;
  hemisphereSkyColor?: [number, number, number];
  hemisphereGroundColor?: [number, number, number];
  lightDebugMode: LightDebugMode;
  debugShadowMap: ShadowDebugMode;
};

export type SceneDTO = {
  lights: LightDTO[];
  objects: ObjectDTO[];
  floorColor: [number, number, number];
  wallColor: [number, number, number];
  showFloor: boolean;
  showWalls: boolean;
  floorSize?: number;
  showGrid?: boolean;
  shadowParams: ShadowParamsDTO;
};
