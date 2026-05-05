import { vec3 } from 'gl-matrix';
import type {
  LightDTO,
  LightDef,
  LightMode,
  ObjectDTO,
  SceneDTO,
  SceneObject,
  ShadowParamsDTO
} from './types';

export function createDefaultLights(params: {
  lightDir: vec3;
  lightMode: LightMode;
  spotYaw: number;
  spotPitch: number;
  lightIntensity: number;
}): LightDef[] {
  return [
    {
      name: 'Light 1',
      pos: vec3.clone(params.lightDir),
      type: params.lightMode,
      yaw: params.spotYaw,
      pitch: params.spotPitch,
      intensity: params.lightIntensity,
      color: vec3.fromValues(1.0, 1.0, 1.0),
      castShadows: true,
      innerConeDeg: 15,
      outerConeDeg: 25,
      range: 14,
      falloff: 1.6
    },
    {
      name: 'Light 2',
      pos: vec3.fromValues(-6, 8, -4),
      type: 'spot',
      yaw: 0.8,
      pitch: -0.6,
      intensity: 0.7,
      color: vec3.fromValues(1.0, 0.9, 0.7),
      castShadows: false,
      innerConeDeg: 18,
      outerConeDeg: 34,
      range: 12,
      falloff: 1.4
    }
  ];
}

export function createDefaultObjects(defaultMeshId: number): SceneObject[] {
  return [
    {
      id: 0,
      name: 'Object 1',
      pos: vec3.fromValues(0, 0, 0),
      scale: vec3.fromValues(1, 1, 1),
      moveSpeed: 1.0,
      color: vec3.fromValues(1.0, 1.0, 1.0),
      castShadows: true,
      receiveShadows: false,
      selfShadows: false,
      meshId: defaultMeshId,
      specular: 0.5,
      shininess: 32.0,
      roughness: 0.45
    }
  ];
}

export function createLight(params: {
  def?: Partial<LightDef>;
  objectPos: vec3;
}): LightDef {
  const basePos = params.def?.pos
    ? vec3.clone(params.def.pos)
    : vec3.fromValues(params.objectPos[0] + 4, 6, params.objectPos[2] + 2);

  return {
    pos: basePos,
    name: params.def?.name ?? 'Light',
    type: params.def?.type ?? 'spot',
    yaw: params.def?.yaw ?? 0.8,
    pitch: params.def?.pitch ?? -0.6,
    intensity: params.def?.intensity ?? 1.0,
    color: params.def?.color ? vec3.clone(params.def.color) : vec3.fromValues(1.0, 1.0, 1.0),
    castShadows: params.def?.castShadows ?? false,
    innerConeDeg: params.def?.innerConeDeg ?? 15,
    outerConeDeg: params.def?.outerConeDeg ?? 28,
    range: params.def?.range ?? 12,
    falloff: params.def?.falloff ?? 1.5
  };
}

export function createSceneObject(params: {
  def?: Partial<SceneObject>;
  id: number;
  objectPos: vec3;
  objectMoveSpeed: number;
  defaultMeshId: number;
}): SceneObject {
  const basePos = params.def?.pos
    ? vec3.clone(params.def.pos)
    : vec3.fromValues(params.objectPos[0] + 2, params.objectPos[1], params.objectPos[2] + 2);

  return {
    id: params.id,
    name: params.def?.name ?? `Object ${params.id + 1}`,
    pos: basePos,
    scale: params.def?.scale ? vec3.clone(params.def.scale) : vec3.fromValues(1, 1, 1),
    moveSpeed: params.def?.moveSpeed ?? params.objectMoveSpeed,
    color: params.def?.color ? vec3.clone(params.def.color) : vec3.fromValues(1.0, 1.0, 1.0),
    castShadows: params.def?.castShadows ?? true,
    receiveShadows: params.def?.receiveShadows ?? false,
    selfShadows: params.def?.selfShadows ?? false,
    meshId: params.def?.meshId ?? params.defaultMeshId,
    specular: params.def?.specular ?? 0.5,
    shininess: params.def?.shininess ?? 32.0,
    roughness: params.def?.roughness ?? 0.45
  };
}

export function lightsToDTO(lights: LightDef[]): LightDTO[] {
  return lights.map((light) => ({
    name: light.name,
    pos: [light.pos[0], light.pos[1], light.pos[2]],
    type: light.type,
    yaw: light.yaw,
    pitch: light.pitch,
    intensity: light.intensity,
    color: [light.color[0], light.color[1], light.color[2]],
    castShadows: light.castShadows,
    innerConeDeg: light.innerConeDeg,
    outerConeDeg: light.outerConeDeg,
    range: light.range,
    falloff: light.falloff
  }));
}

export function objectsToDTO(objects: SceneObject[], defaultMeshId: number): ObjectDTO[] {
  return objects.map((object) => ({
    name: object.name,
    pos: [object.pos[0], object.pos[1], object.pos[2]],
    scale: [object.scale[0], object.scale[1], object.scale[2]],
    moveSpeed: object.moveSpeed,
    color: [object.color[0], object.color[1], object.color[2]],
    castShadows: object.castShadows,
    receiveShadows: object.receiveShadows,
    selfShadows: object.selfShadows,
    meshId: object.meshId ?? defaultMeshId,
    specular: object.specular,
    shininess: object.shininess,
    roughness: object.roughness
  }));
}

export function lightsFromDTO(lights: LightDTO[]): LightDef[] {
  return lights.map((light) => ({
    name: light.name ?? 'Light',
    pos: vec3.fromValues(light.pos[0], light.pos[1], light.pos[2]),
    type: light.type,
    yaw: light.yaw,
    pitch: light.pitch,
    intensity: light.intensity,
    color: vec3.fromValues(
      light.color?.[0] ?? 1.0,
      light.color?.[1] ?? 1.0,
      light.color?.[2] ?? 1.0
    ),
    castShadows: light.castShadows ?? false,
    innerConeDeg: light.innerConeDeg ?? 15,
    outerConeDeg: light.outerConeDeg ?? 28,
    range: light.range ?? 12,
    falloff: light.falloff ?? 1.5
  }));
}

export function objectsFromDTO(objects: ObjectDTO[], defaultMeshId: number): SceneObject[] {
  return objects.map((object, index) => ({
    id: index,
    name: object.name ?? `Object ${index + 1}`,
    pos: vec3.fromValues(object.pos[0], object.pos[1], object.pos[2]),
    scale: vec3.fromValues(
      object.scale?.[0] ?? 1,
      object.scale?.[1] ?? 1,
      object.scale?.[2] ?? 1
    ),
    moveSpeed: object.moveSpeed,
    color: vec3.fromValues(
      object.color?.[0] ?? 1.0,
      object.color?.[1] ?? 1.0,
      object.color?.[2] ?? 1.0
    ),
    castShadows: object.castShadows ?? true,
    receiveShadows: object.receiveShadows ?? false,
    selfShadows: object.selfShadows ?? false,
    meshId: object.meshId ?? defaultMeshId,
    specular: object.specular ?? 0.5,
    shininess: object.shininess ?? 32.0,
    roughness: object.roughness ?? 0.45
  }));
}

export function createSceneDTO(params: {
  lights: LightDef[];
  objects: SceneObject[];
  defaultMeshId: number;
  floorColor: vec3;
  wallColor: vec3;
  showFloor: boolean;
  showWalls: boolean;
  floorSize: number;
  showGrid: boolean;
  shadowParams: ShadowParamsDTO;
}): SceneDTO {
  return {
    lights: lightsToDTO(params.lights),
    objects: objectsToDTO(params.objects, params.defaultMeshId),
    floorColor: [params.floorColor[0], params.floorColor[1], params.floorColor[2]],
    wallColor: [params.wallColor[0], params.wallColor[1], params.wallColor[2]],
    showFloor: params.showFloor,
    showWalls: params.showWalls,
    floorSize: params.floorSize,
    showGrid: params.showGrid,
    shadowParams: { ...params.shadowParams }
  };
}
