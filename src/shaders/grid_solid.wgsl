// @include lighting_common

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
  cameraPos: vec4<f32>,
  shadowParams: vec4<f32>,
};

struct GridParams {
  floorColor: vec3<f32>,
  _pad0: f32,
  wallColor: vec3<f32>,
  _pad1: f32,
};

struct ShadowMatrices {
  count: f32,
  _pad0: vec3<f32>,
  mats: array<mat4x4<f32>, 2>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<uniform> gridParams: GridParams;
@group(0) @binding(2) var<uniform> shadowMats: ShadowMatrices;

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

@group(2) @binding(0) var floorTex: texture_2d<f32>;
@group(2) @binding(1) var floorSampler: sampler;

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
@group(3) @binding(1) var<uniform> lightsData: LightsData;

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
  let uv = ndcToUv(ndc);
  // bias храним в u.shadowParams.x для SM/PCF/PCSS
  let depth = ndc.z - u.shadowParams.x;
  let inBounds = isInBounds(ndc);

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

fn computeLightContributionFloor(
  N: vec3<f32>,
  worldPos: vec3<f32>,
  light: Light,
  isShadowed: bool,
  lightSpacePos: vec4<f32>
) -> f32 {
  let L = computeLightDirection(light, worldPos);
  let lambert = max(dot(N, L), 0.0) * computeSpotFactor(light, worldPos);

  var vis: f32 = 1.0;
  if (isShadowed) {
    let rawVisibility = shadowVisibilityFloor(lightSpacePos);
    vis = mixShadowStrength(rawVisibility, shading.shadowStrength);
  }

  let intensity = max(light.intensity, 0.0);
  return lambert * vis * intensity;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let _shadowCount = shadowMats.count;

  // Процедурная сетка (линии)
  let gridSize = 1.0;
  let coord = input.worldPos.xz / gridSize;

  let grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  let line = min(grid.x, grid.y);
  let gridAlpha = 1.0 - min(line, 1.0);

  // Всегда сэмплируем текстуру (uniform control flow)
  let texColor = textureSample(floorTex, floorSampler, input.uv).xyz;
  let isFloor = abs(input.worldN.y - 1.0) < 0.5;

  var baseColor: vec3<f32>;
  if (isFloor) {
    baseColor = gridParams.floorColor * texColor;
    let gridLineColor = vec3<f32>(0.7, 0.75, 0.8);
    baseColor = mix(baseColor, gridLineColor, gridAlpha);
  } else {
    baseColor = gridParams.wallColor;
  }

  let N = normalize(input.worldN);
  let worldPos = input.worldPos;
  let ambient = 0.4;

  let lightCount = i32(round(lightsData.count));
  var diffuseSum: vec3<f32> = vec3<f32>(0.0);
  let caster = i32(round(shading.shadowCaster0));

  for (var i = 0; i < lightCount; i = i + 1) {
    let light = lightsData.lights[i];
    let isShadowed = (i == caster);

    let contrib = computeLightContributionFloor(
      N,
      worldPos,
      light,
      isShadowed,
      input.lightSpacePos
    );
    diffuseSum = diffuseSum + contrib * light.color;
  }

  let diffuse = (1.0 - ambient) * diffuseSum;
  let lighting = clamp(ambient + diffuse, vec3<f32>(0.0), vec3<f32>(1.0));
  let finalColor = baseColor * lighting;
  return vec4<f32>(finalColor, 1.0);
}
