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

export type LightDef = {
  pos: vec3;
  type: LightMode;
  yaw: number;
  pitch: number;
  intensity: number;
  color: vec3;
  castShadows: boolean;
};

export type SceneObject = {
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
  pos: [number, number, number];
  type: LightMode;
  yaw: number;
  pitch: number;
  intensity: number;
  color: [number, number, number];
  castShadows: boolean;
};

export type ObjectDTO = {
  pos: [number, number, number];
  moveSpeed: number;
  color: [number, number, number];
  castShadows: boolean;
  receiveShadows: boolean;
  meshId: number;
  specular: number;
  shininess: number;
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
};

export type SceneDTO = {
  lights: LightDTO[];
  objects: ObjectDTO[];
  floorColor: [number, number, number];
  wallColor: [number, number, number];
  showFloor: boolean;
  showWalls: boolean;
  shadowParams: ShadowParamsDTO;
};
