import type { LightMode, ShadowMethod, ShadowParamsDTO } from './types';

export type ScenePresetId =
  | 'multipleObjects'
  | 'stairs'
  | 'forest'
  | 'aliasingTest'
  | 'penumbraTest'
  | 'multiLightTest'
  | 'vsmBleedingTest';

export type ScenePresetObject = {
  name?: string;
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
  name?: string;
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
  floorSize?: number;
  showGrid?: boolean;
  shadowMethod?: ShadowMethod;
  shadowParams?: Partial<ShadowParamsDTO>;
};

const floorY = -2.5;

const cubeOnFloorY = (halfHeight = 1) => floorY + halfHeight;

export const SCENE_PRESETS: Record<ScenePresetId, ScenePreset> = {
  multipleObjects: {
    id: 'multipleObjects',
    label: { en: 'Multiple Objects', ru: 'Несколько объектов' },
    showFloor: true,
    showWalls: true,
    floorSize: 12,
    showGrid: true,
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
    floorSize: 12,
    showGrid: true,
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
    floorSize: 14,
    showGrid: false,
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
  },
  aliasingTest: {
    id: 'aliasingTest',
    label: { en: 'Aliasing Test', ru: 'Aliasing тест' },
    showFloor: true,
    showWalls: false,
    floorSize: 16,
    showGrid: true,
    floorColor: [0.15, 0.16, 0.17],
    wallColor: [0.1, 0.11, 0.12],
    shadowMethod: 'SM',
    shadowParams: {
      shadowMapSize: 512,
      bias: 0.006,
      shadowStrength: 1.18,
      ambientStrength: 0.32,
      exposure: 0.92
    },
    objects: [
      {
        name: 'Long receiver',
        pos: [0, cubeOnFloorY(0.05), 0.4],
        scale: [6.5, 0.05, 2.6],
        meshId: 0,
        color: [0.58, 0.6, 0.62],
        receiveShadows: true,
        castShadows: false,
        roughness: 0.82,
        specular: 0.12
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        name: `Thin blocker ${index + 1}`,
        pos: [-3 + index, cubeOnFloorY(0.9 + (index % 2) * 0.2), -1.4 + index * 0.24] as [number, number, number],
        scale: [0.14, 0.9 + (index % 2) * 0.2, 0.14] as [number, number, number],
        meshId: 0,
        color: [0.82, 0.72, 0.58] as [number, number, number],
        receiveShadows: true,
        selfShadows: true,
        roughness: 0.62,
        specular: 0.2
      }))
    ],
    lights: [
      {
        name: 'Low angle sun',
        pos: [-7.5, 6.0, 5.5],
        type: 'sun',
        intensity: 1.15,
        color: [1.0, 0.88, 0.7],
        castShadows: true
      }
    ]
  },
  penumbraTest: {
    id: 'penumbraTest',
    label: { en: 'Penumbra Test', ru: 'Полутени' },
    showFloor: true,
    showWalls: false,
    floorSize: 14,
    showGrid: false,
    floorColor: [0.18, 0.18, 0.16],
    wallColor: [0.1, 0.105, 0.11],
    shadowMethod: 'PCSS',
    shadowParams: {
      shadowMapSize: 2048,
      bias: 0.0025,
      pcssLightSize: 0.14,
      pcssBlockerSearchSamples: 32,
      shadowStrength: 1.18,
      ambientStrength: 0.24,
      exposure: 0.95
    },
    objects: [
      {
        name: 'Gnomon stem',
        pos: [-0.18, floorY + 1.02, -0.2],
        scale: [0.13, 0.98, 0.13],
        meshId: 0,
        color: [0.9, 0.74, 0.48],
        receiveShadows: true,
        selfShadows: true,
        roughness: 0.46,
        specular: 0.28
      },
      {
        name: 'Gnomon foot',
        pos: [-0.18, floorY + 0.19, -0.2],
        scale: [0.42, 0.08, 0.42],
        meshId: 2,
        color: [0.74, 0.62, 0.42],
        receiveShadows: true,
        selfShadows: true,
        roughness: 0.5,
        specular: 0.18
      },
      {
        name: 'Gnomon tip',
        pos: [-0.18, floorY + 2.02, -0.2],
        scale: [0.23, 0.23, 0.23],
        meshId: 2,
        color: [0.92, 0.78, 0.54],
        receiveShadows: true,
        selfShadows: true,
        roughness: 0.38,
        specular: 0.34
      },
      ...Array.from({ length: 13 }, (_, index) => {
        const angle = (-150 + index * 25) * Math.PI / 180;
        const radius = 2.35;
        return {
        name: `Hour mark ${index + 1}`,
        pos: [Math.sin(angle) * radius, floorY + 0.23, Math.cos(angle) * radius] as [number, number, number],
        scale: [0.13, 0.08, 0.13] as [number, number, number],
        meshId: 2,
        color: [0.38, 0.35, 0.28] as [number, number, number],
        receiveShadows: true,
        castShadows: false,
        roughness: 0.8,
        specular: 0.08
        };
      })
    ],
    lights: [
      {
        name: 'Low angled sun',
        pos: [-4.6, 3.2, -2.2],
        type: 'sun',
        intensity: 1.65,
        color: [1.0, 0.86, 0.62],
        castShadows: true,
        range: 24
      }
    ]
  },
  multiLightTest: {
    id: 'multiLightTest',
    label: { en: 'Multi-light Test', ru: 'Несколько теней' },
    showFloor: true,
    showWalls: false,
    floorSize: 12,
    showGrid: true,
    floorColor: [0.14, 0.15, 0.16],
    wallColor: [0.1, 0.1, 0.11],
    shadowMethod: 'PCF',
    shadowParams: {
      shadowMapSize: 2048,
      bias: 0.003,
      pcfRadius: 2,
      pcfSamples: 16,
      shadowStrength: 1.05,
      ambientStrength: 0.28
    },
    objects: [
      {
        name: 'Center blocker',
        pos: [0, cubeOnFloorY(0.9), 0],
        scale: [0.9, 0.9, 0.9],
        meshId: 2,
        color: [0.8, 0.74, 0.64],
        receiveShadows: true,
        selfShadows: true,
        roughness: 0.46,
        specular: 0.42
      },
      {
        name: 'Left receiver',
        pos: [-2.2, cubeOnFloorY(0.08), 0.8],
        scale: [1.9, 0.08, 1.1],
        meshId: 0,
        color: [0.5, 0.58, 0.68],
        receiveShadows: true,
        castShadows: false,
        roughness: 0.78
      },
      {
        name: 'Right receiver',
        pos: [2.2, cubeOnFloorY(0.08), 0.8],
        scale: [1.9, 0.08, 1.1],
        meshId: 0,
        color: [0.58, 0.52, 0.66],
        receiveShadows: true,
        castShadows: false,
        roughness: 0.78
      }
    ],
    lights: [
      {
        name: 'Red spot',
        pos: [-4.8, 6.0, 3.4],
        type: 'spot',
        yaw: 2.2,
        pitch: -0.82,
        intensity: 3.0,
        color: [1.0, 0.18, 0.12],
        castShadows: true,
        innerConeDeg: 18,
        outerConeDeg: 50,
        range: 24,
        falloff: 1.05
      },
      {
        name: 'Blue spot',
        pos: [4.8, 6.0, 3.4],
        type: 'spot',
        yaw: -2.2,
        pitch: -0.82,
        intensity: 3.0,
        color: [0.12, 0.38, 1.0],
        castShadows: true,
        innerConeDeg: 18,
        outerConeDeg: 50,
        range: 24,
        falloff: 1.05
      }
    ]
  },
  vsmBleedingTest: {
    id: 'vsmBleedingTest',
    label: { en: 'VSM Bleeding Test', ru: 'VSM протекание' },
    showFloor: true,
    showWalls: false,
    floorSize: 16,
    showGrid: false,
    floorColor: [0.26, 0.24, 0.18],
    wallColor: [0.12, 0.11, 0.08],
    shadowMethod: 'VSM',
    shadowParams: {
      shadowMapSize: 2048,
      vsmMinVariance: 0.00012,
      vsmLightBleedReduction: 0.18,
      shadowStrength: 1.28,
      ambientStrength: 0.12,
      exposure: 0.82,
      hemisphereSkyColor: [0.7, 0.62, 0.46],
      hemisphereGroundColor: [0.08, 0.07, 0.05]
    },
    objects: [
      {
        name: 'Spotlight wall',
        pos: [0, 1.95, -2.15],
        scale: [7.4, 4.45, 0.08],
        meshId: 0,
        color: [0.25, 0.23, 0.17],
        receiveShadows: true,
        castShadows: false,
        specular: 0.08,
        roughness: 0.86
      },
      {
        name: 'Narrow beam sphere',
        pos: [-5.1, floorY + 0.82, -1.25],
        scale: [0.62, 0.62, 0.62],
        meshId: 2,
        color: [0.82, 0.76, 0.63],
        receiveShadows: true,
        selfShadows: true,
        specular: 0.32,
        roughness: 0.64
      },
      {
        name: 'Medium beam sphere',
        pos: [-1.7, floorY + 0.82, -1.25],
        scale: [0.62, 0.62, 0.62],
        meshId: 2,
        color: [0.74, 0.69, 0.57],
        receiveShadows: true,
        selfShadows: true,
        specular: 0.28,
        roughness: 0.68
      },
      {
        name: 'Angled leak sphere',
        pos: [1.7, floorY + 0.82, -1.25],
        scale: [0.62, 0.62, 0.62],
        meshId: 2,
        color: [0.55, 0.52, 0.44],
        receiveShadows: true,
        selfShadows: true,
        specular: 0.18,
        roughness: 0.76
      },
      {
        name: 'Wide beam sphere',
        pos: [5.1, floorY + 0.82, -1.25],
        scale: [0.62, 0.62, 0.62],
        meshId: 2,
        color: [0.7, 0.66, 0.55],
        receiveShadows: true,
        selfShadows: true,
        specular: 0.24,
        roughness: 0.7
      }
    ],
    lights: [
      {
        name: 'Narrow spotlight',
        pos: [-5.1, 5.8, 0.05],
        type: 'spot',
        yaw: 3.142,
        pitch: -1.403,
        intensity: 3.4,
        color: [1.0, 0.9, 0.68],
        castShadows: true,
        innerConeDeg: 4,
        outerConeDeg: 13,
        range: 9,
        falloff: 2.2
      },
      {
        name: 'Soft oval spotlight',
        pos: [-1.7, 5.85, 0.05],
        type: 'spot',
        yaw: 3.142,
        pitch: -1.404,
        intensity: 2.65,
        color: [1.0, 0.88, 0.64],
        castShadows: true,
        innerConeDeg: 8,
        outerConeDeg: 24,
        range: 10,
        falloff: 1.75
      },
      {
        name: 'Angled spill spotlight',
        pos: [1.7, 5.95, 0.1],
        type: 'spot',
        yaw: 3.142,
        pitch: -1.400,
        intensity: 2.35,
        color: [1.0, 0.86, 0.58],
        castShadows: true,
        innerConeDeg: 10,
        outerConeDeg: 32,
        range: 12,
        falloff: 1.35
      },
      {
        name: 'Wide spotlight',
        pos: [5.1, 6.15, 0.2],
        type: 'spot',
        yaw: 3.142,
        pitch: -1.392,
        intensity: 2.85,
        color: [1.0, 0.9, 0.68],
        castShadows: true,
        innerConeDeg: 18,
        outerConeDeg: 48,
        range: 15,
        falloff: 1.05
      }
    ]
  }
};

export const SCENE_PRESET_OPTIONS = Object.values(SCENE_PRESETS);
