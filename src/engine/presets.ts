import type { LightMode, ShadowMethod } from './types';

export type ScenePresetId = 'multipleObjects' | 'stairs' | 'forest';

export type ScenePresetObject = {
  pos: [number, number, number];
  scale?: [number, number, number];
  meshId?: number;
  color?: [number, number, number];
  castShadows?: boolean;
  receiveShadows?: boolean;
  selfShadows?: boolean;
  specular?: number;
  shininess?: number;
  roughness?: number;
};

export type ScenePresetLight = {
  pos: [number, number, number];
  type: LightMode;
  yaw?: number;
  pitch?: number;
  intensity?: number;
  color?: [number, number, number];
  castShadows?: boolean;
  innerConeDeg?: number;
  outerConeDeg?: number;
  range?: number;
  falloff?: number;
};

export type ScenePreset = {
  id: ScenePresetId;
  label: { en: string; ru: string };
  objects: ScenePresetObject[];
  lights: ScenePresetLight[];
  floorColor: [number, number, number];
  wallColor: [number, number, number];
  showFloor: boolean;
  showWalls: boolean;
  shadowMethod?: ShadowMethod;
};

const floorY = -2.5;

const cubeOnFloorY = (halfHeight = 1) => floorY + halfHeight;

export const SCENE_PRESETS: Record<ScenePresetId, ScenePreset> = {
  multipleObjects: {
    id: 'multipleObjects',
    label: { en: 'Multiple Objects', ru: 'Несколько объектов' },
    showFloor: true,
    showWalls: true,
    floorColor: [0.14, 0.15, 0.17],
    wallColor: [0.1, 0.11, 0.13],
    shadowMethod: 'PCF',
    objects: [
      {
        pos: [-3.2, cubeOnFloorY(0.8), -1.5],
        scale: [0.8, 0.8, 0.8],
        meshId: 1,
        color: [0.92, 0.68, 0.5],
        receiveShadows: true,
        specular: 0.45,
        roughness: 0.42
      },
      {
        pos: [-0.8, cubeOnFloorY(1.15), 0.4],
        scale: [1, 1, 1],
        meshId: 2,
        color: [0.62, 0.76, 1.0],
        receiveShadows: true,
        selfShadows: true,
        specular: 0.7,
        roughness: 0.24
      },
      {
        pos: [1.8, cubeOnFloorY(0.55), -1.0],
        scale: [1.3, 0.55, 0.85],
        meshId: 0,
        color: [0.66, 0.88, 0.7],
        receiveShadows: true,
        specular: 0.35,
        roughness: 0.58
      },
      {
        pos: [3.6, cubeOnFloorY(1.35), 1.3],
        scale: [0.7, 1.35, 0.7],
        meshId: 1,
        color: [0.95, 0.9, 0.66],
        receiveShadows: true,
        specular: 0.55,
        roughness: 0.35
      },
      {
        pos: [0.8, cubeOnFloorY(0.4), 2.6],
        scale: [1.8, 0.4, 1.0],
        meshId: 0,
        color: [0.8, 0.74, 0.68],
        receiveShadows: true,
        castShadows: false,
        specular: 0.2,
        roughness: 0.78
      }
    ],
    lights: [
      {
        pos: [5.5, 7.2, 4.2],
        type: 'spot',
        yaw: -2.32,
        pitch: -0.72,
        intensity: 1.25,
        color: [1.0, 0.82, 0.66],
        castShadows: true,
        innerConeDeg: 18,
        outerConeDeg: 38,
        range: 17,
        falloff: 1.35
      },
      {
        pos: [-5.5, 5.8, -4.0],
        type: 'spot',
        yaw: 0.82,
        pitch: -0.55,
        intensity: 0.65,
        color: [0.56, 0.7, 1.0],
        castShadows: false,
        innerConeDeg: 20,
        outerConeDeg: 44,
        range: 15,
        falloff: 1.5
      }
    ]
  },
  stairs: {
    id: 'stairs',
    label: { en: 'Stairs', ru: 'Ступени' },
    showFloor: true,
    showWalls: true,
    floorColor: [0.13, 0.14, 0.15],
    wallColor: [0.11, 0.1, 0.1],
    shadowMethod: 'PCF',
    objects: Array.from({ length: 8 }, (_, index) => {
      const height = 0.25 + index * 0.18;
      return {
        pos: [-3.5 + index, cubeOnFloorY(height), -0.25 + index * 0.18],
        scale: [0.62, height, 1.6],
        meshId: 0,
        color: [0.5 + index * 0.035, 0.52 + index * 0.025, 0.55 + index * 0.018] as [number, number, number],
        receiveShadows: true,
        selfShadows: true,
        specular: 0.24,
        roughness: 0.72
      };
    }),
    lights: [
      {
        pos: [-4.5, 7.2, 4.8],
        type: 'spot',
        yaw: 2.38,
        pitch: -0.68,
        intensity: 1.4,
        color: [1.0, 0.86, 0.7],
        castShadows: true,
        innerConeDeg: 14,
        outerConeDeg: 32,
        range: 18,
        falloff: 1.45
      },
      {
        pos: [4.8, 8.5, -3.5],
        type: 'sun',
        intensity: 0.25,
        color: [0.72, 0.82, 1.0],
        castShadows: false
      }
    ]
  },
  forest: {
    id: 'forest',
    label: { en: 'Forest', ru: 'Лес' },
    showFloor: true,
    showWalls: false,
    floorColor: [0.11, 0.18, 0.12],
    wallColor: [0.08, 0.11, 0.09],
    shadowMethod: 'VSM',
    objects: [
      ...[
        [-4.4, -2.6],
        [-3.0, 1.3],
        [-1.8, -1.4],
        [-0.5, 2.9],
        [1.0, -2.2],
        [2.4, 0.6],
        [3.6, -1.2],
        [4.2, 2.2],
        [-4.0, 3.4],
        [0.9, 3.8]
      ].flatMap(([x, z], index) => {
        const trunkHeight = 1.2 + (index % 3) * 0.24;
        const crownScale = 0.75 + (index % 4) * 0.08;
        return [
          {
            pos: [x, cubeOnFloorY(trunkHeight), z] as [number, number, number],
            scale: [0.16, trunkHeight, 0.16] as [number, number, number],
            meshId: 0,
            color: [0.45, 0.25, 0.14] as [number, number, number],
            receiveShadows: true,
            selfShadows: true,
            specular: 0.12,
            roughness: 0.85
          },
          {
            pos: [x, floorY + trunkHeight * 2 + crownScale * 0.9, z] as [number, number, number],
            scale: [crownScale, crownScale * 0.72, crownScale] as [number, number, number],
            meshId: 2,
            color: [0.18, 0.42 + (index % 3) * 0.04, 0.2] as [number, number, number],
            receiveShadows: true,
            selfShadows: true,
            specular: 0.18,
            roughness: 0.68
          }
        ];
      }),
      {
        pos: [0, cubeOnFloorY(0.08), 0.5],
        scale: [7.5, 0.08, 4.8],
        meshId: 0,
        color: [0.13, 0.24, 0.12],
        receiveShadows: true,
        castShadows: false,
        specular: 0.08,
        roughness: 0.9
      }
    ],
    lights: [
      {
        pos: [6.2, 9.0, 4.5],
        type: 'sun',
        intensity: 1.05,
        color: [1.0, 0.88, 0.68],
        castShadows: true
      },
      {
        pos: [-4.8, 4.2, 3.8],
        type: 'spot',
        yaw: 2.45,
        pitch: -0.45,
        intensity: 0.38,
        color: [0.5, 0.68, 1.0],
        castShadows: false,
        innerConeDeg: 24,
        outerConeDeg: 52,
        range: 14,
        falloff: 1.8
      }
    ]
  }
};

export const SCENE_PRESET_OPTIONS = Object.values(SCENE_PRESETS);
