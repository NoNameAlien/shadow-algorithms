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
      pos: vec3.clone(params.lightDir),
      type: params.lightMode,
      yaw: params.spotYaw,
      pitch: params.spotPitch,
      intensity: params.lightIntensity,
      color: vec3.fromValues(1.0, 1.0, 1.0),
      castShadows: true
    },
    {
      pos: vec3.fromValues(-6, 8, -4),
      type: 'spot',
      yaw: 0.8,
      pitch: -0.6,
      intensity: 0.7,
      color: vec3.fromValues(1.0, 0.9, 0.7),
      castShadows: false
    }
  ];
}

export function createDefaultObjects(defaultMeshId: number): SceneObject[] {
  return [
    {
      id: 0,
      pos: vec3.fromValues(0, 0, 0),
      moveSpeed: 1.0,
      color: vec3.fromValues(1.0, 1.0, 1.0),
      castShadows: true,
      receiveShadows: true,
      meshId: defaultMeshId,
      specular: 0.5,
      shininess: 32.0
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
    type: params.def?.type ?? 'spot',
    yaw: params.def?.yaw ?? 0.8,
    pitch: params.def?.pitch ?? -0.6,
    intensity: params.def?.intensity ?? 1.0,
    color: params.def?.color ? vec3.clone(params.def.color) : vec3.fromValues(1.0, 1.0, 1.0),
    castShadows: params.def?.castShadows ?? false
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
    pos: basePos,
    moveSpeed: params.def?.moveSpeed ?? params.objectMoveSpeed,
    color: params.def?.color ? vec3.clone(params.def.color) : vec3.fromValues(1.0, 1.0, 1.0),
    castShadows: params.def?.castShadows ?? true,
    receiveShadows: params.def?.receiveShadows ?? true,
    meshId: params.def?.meshId ?? params.defaultMeshId,
    specular: params.def?.specular ?? 0.5,
    shininess: params.def?.shininess ?? 32.0
  };
}

export function lightsToDTO(lights: LightDef[]): LightDTO[] {
  return lights.map((light) => ({
    pos: [light.pos[0], light.pos[1], light.pos[2]],
    type: light.type,
    yaw: light.yaw,
    pitch: light.pitch,
    intensity: light.intensity,
    color: [light.color[0], light.color[1], light.color[2]],
    castShadows: light.castShadows
  }));
}

export function objectsToDTO(objects: SceneObject[], defaultMeshId: number): ObjectDTO[] {
  return objects.map((object) => ({
    pos: [object.pos[0], object.pos[1], object.pos[2]],
    moveSpeed: object.moveSpeed,
    color: [object.color[0], object.color[1], object.color[2]],
    castShadows: object.castShadows,
    receiveShadows: object.receiveShadows,
    meshId: object.meshId ?? defaultMeshId,
    specular: object.specular,
    shininess: object.shininess
  }));
}

export function lightsFromDTO(lights: LightDTO[]): LightDef[] {
  return lights.map((light) => ({
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
    castShadows: light.castShadows ?? false
  }));
}

export function objectsFromDTO(objects: ObjectDTO[], defaultMeshId: number): SceneObject[] {
  return objects.map((object, index) => ({
    id: index,
    pos: vec3.fromValues(object.pos[0], object.pos[1], object.pos[2]),
    moveSpeed: object.moveSpeed,
    color: vec3.fromValues(
      object.color?.[0] ?? 1.0,
      object.color?.[1] ?? 1.0,
      object.color?.[2] ?? 1.0
    ),
    castShadows: object.castShadows ?? true,
    receiveShadows: object.receiveShadows ?? true,
    meshId: object.meshId ?? defaultMeshId,
    specular: object.specular ?? 0.5,
    shininess: object.shininess ?? 32.0
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
  shadowParams: ShadowParamsDTO;
}): SceneDTO {
  return {
    lights: lightsToDTO(params.lights),
    objects: objectsToDTO(params.objects, params.defaultMeshId),
    floorColor: [params.floorColor[0], params.floorColor[1], params.floorColor[2]],
    wallColor: [params.wallColor[0], params.wallColor[1], params.wallColor[2]],
    showFloor: params.showFloor,
    showWalls: params.showWalls,
    shadowParams: { ...params.shadowParams }
  };
}
