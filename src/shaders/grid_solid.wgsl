struct VSIn {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldN: vec3<f32>,
  @location(2) lightSpacePos: vec4<f32>,
  @location(3) uv: vec2<f32>,
};

struct Uniforms {
  model: mat4x4<f32>,
  viewProj: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  lightDir: vec4<f32>,
  shadowParams: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

const PI: f32 = 3.14159265;
const LIGHT_MODE_SUN: i32 = 0;
const LIGHT_MODE_SPOT: i32 = 1;
const LIGHT_MODE_TOP: i32 = 2;

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

@group(2) @binding(0) var floorTex: texture_2d<f32>;
@group(2) @binding(1) var floorSampler: sampler;

struct ShadingParams {
  shadowStrength: f32,
  lightMode: f32,
  spotYaw: f32,
  spotPitch: f32,
  methodIndex: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

const POISSON_16: array<vec2<f32>, 16> = array<vec2<f32>, 16>(
  vec2<f32>(-0.613, 0.354), vec2<f32>(0.743, -0.125),
  vec2<f32>(-0.212, -0.532), vec2<f32>(0.124, 0.987),
  vec2<f32>(-0.945, -0.123), vec2<f32>(0.432, 0.456),
  vec2<f32>(-0.321, 0.765), vec2<f32>(0.876, 0.321),
  vec2<f32>(-0.111, -0.987), vec2<f32>(0.234, -0.654),
  vec2<f32>(-0.765, 0.111), vec2<f32>(0.567, -0.876),
  vec2<f32>(-0.456, -0.234), vec2<f32>(0.789, 0.654),
  vec2<f32>(-0.888, 0.444), vec2<f32>(0.111, -0.111),
);

@group(3) @binding(0) var<uniform> shading: ShadingParams;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  out.clipPos = u.viewProj * vec4<f32>(input.position, 1.0);
  out.worldN = input.normal;
  out.worldPos = input.position;
  out.lightSpacePos = u.lightViewProj * vec4<f32>(input.position, 1.0);
  out.uv = input.uv;
  return out;
}

fn shadowVisibilityFloor(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = vec2<f32>(
    ndc.x * 0.5 + 0.5,
    1.0 - (ndc.y * 0.5 + 0.5)
  );
  // bias храним в u.shadowParams.x для SM/PCF/PCSS
  let depth = ndc.z - u.shadowParams.x;

  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 &&
                 ndc.y >= -1.0 && ndc.y <= 1.0 &&
                 ndc.z >= 0.0 && ndc.z <= 1.0;

  // Индекс метода: 0=SM,1=PCF,2=PCSS,3=VSM
  let method = i32(round(shading.methodIndex));

  var radius: f32;
  var samples: i32;
  var invSize: f32;

  if (method == 1) {
    // PCF: радиус и количество сэмплов из параметров
    radius = u.shadowParams.y;                // pcfRadius
    samples = i32(u.shadowParams.z);         // pcfSamples
    invSize = 1.0 / max(u.shadowParams.w, 1.0); // shadowMapSize
  } else if (method == 2) {
    // PCSS: используем lightSize как эффективный радиус
    radius = u.shadowParams.y * 2.0;         // pcssLightSize → ширина
    samples = 16;
    invSize = 1.0 / max(u.shadowParams.w, 1.0);
  } else if (method == 3) {
    // VSM: для пола пока даём мягкий PCF средней силы
    radius = 1.5;
    samples = 16;
    invSize = 1.0 / 2048.0;
  } else {
    // SM: один sample (жёсткие тени)
    radius = 0.0;
    samples = 1;
    invSize = 1.0 / max(u.shadowParams.w, 1.0);
  }

  let maxSamples = max(1, min(samples, 16));

  var shadow: f32 = 0.0;
  for (var i = 0; i < 16; i = i + 1) {
    if (i < maxSamples) {
      let offset = POISSON_16[i] * radius * invSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
  }
  shadow = shadow / f32(maxSamples);

  return select(shadow, 1.0, !inBounds);
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  // Процедурная сетка (линии)
  let gridSize = 1.0;
  let coord = input.worldPos.xz / gridSize;
  let grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  let line = min(grid.x, grid.y);
  let gridAlpha = 1.0 - min(line, 1.0);
  
    // Освещение для grid (учитываем режим света и прожектор)
  let N = normalize(input.worldN);
  let lightPos = u.lightDir.xyz;

  let mode = i32(round(shading.lightMode));

  var L: vec3<f32>;
  var lambert: f32;

  if (mode == LIGHT_MODE_TOP) {
    L = normalize(vec3<f32>(0.0, 1.0, 0.0));
    lambert = max(dot(N, L), 0.0);
  } else if (mode == LIGHT_MODE_SPOT) {
    // Прожектор: направление задаётся yaw/pitch
    let yaw = shading.spotYaw;
    let pitch = shading.spotPitch;

    let axis = vec3<f32>(
      cos(pitch) * sin(yaw),
      sin(pitch),
      cos(pitch) * cos(yaw)
    );

    let toFrag = normalize(input.worldPos - lightPos); // из света к полу
    L = normalize(lightPos - input.worldPos);          // из пола к свету

    lambert = max(dot(N, L), 0.0);

    let cosAngle = dot(toFrag, axis);
    let innerDeg: f32 = 15.0;
    let outerDeg: f32 = 25.0;
    let inner = cos(innerDeg * PI / 180.0);
    let outer = cos(outerDeg * PI / 180.0);
    let tSpot = clamp((cosAngle - outer) / (inner - outer), 0.0, 1.0);
    lambert = lambert * tSpot;
  } else {
    // Sun: directional от позиции света
    L = normalize(lightPos);
    lambert = max(dot(N, L), 0.0);
  }

  let rawVisibility = shadowVisibilityFloor(input.lightSpacePos);
  
  // Цвет сетки
  let gridColor = vec3<f32>(0.3, 0.35, 0.4);
  var baseColor = vec3<f32>(0.15, 0.16, 0.18);
  let texColor = textureSample(floorTex, floorSampler, input.uv).xyz;
  baseColor = mix(baseColor, texColor, 1.0);
    
  // Смешиваем сетку с фоном
  let color = mix(baseColor, gridColor, gridAlpha);
  
  // немного более тёмный пол, чем раньше
  let ambient = 0.4;

  let strength = clamp(shading.shadowStrength, 0.0, 2.0);

  let t = clamp(strength, 0.0, 1.0);
  var vis = mix(1.0, rawVisibility, t);

  if (strength > 1.0) {
    let extra = strength - 1.0;
    vis = max(0.0, vis * (1.0 - extra));
  }

  let diffuse = (1.0 - ambient) * lambert * vis;
  let finalColor = color * clamp(ambient + diffuse, 0.0, 1.0);
  return vec4<f32>(finalColor, 1.0);
}
