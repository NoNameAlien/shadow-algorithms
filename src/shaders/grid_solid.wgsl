// @include lighting_common
// @include poisson64

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
  options: vec4<f32>, // x: floor size, y: show grid
};

struct ShadowMatrices {
  count: f32,
  _pad0: vec3<f32>,
  mats: array<mat4x4<f32>, 8>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<uniform> gridParams: GridParams;
@group(0) @binding(2) var<uniform> shadowMats: ShadowMatrices;

@group(1) @binding(0) var shadowMap: texture_depth_2d_array;
@group(1) @binding(1) var shadowSampler: sampler_comparison;
@group(1) @binding(2) var momentsTex: texture_2d_array<f32>;
@group(1) @binding(3) var momentsSampler: sampler;

@group(2) @binding(0) var floorTex: texture_2d<f32>;
@group(2) @binding(1) var floorSampler: sampler;

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

fn loadShadowDepthFloor(lightIndex: i32, uv: vec2<f32>) -> f32 {
  let size = i32(shadowMapSize(u.shadowParams));
  let coords = clamp(vec2<i32>(uv * f32(size)), vec2<i32>(0), vec2<i32>(size - 1));
  return textureLoad(shadowMap, coords, lightIndex, 0);
}

fn linearizePerspectiveDepthFloor(depth: f32, near: f32, far: f32) -> f32 {
  let distance = (near * far) / max(far - depth * (far - near), 0.000001);
  return clamp((distance - near) / max(far - near, 0.000001), 0.0, 1.0);
}

fn pcssDepthForFloorLight(light: Light, rawDepth: f32) -> f32 {
  let mode = i32(round(light.lightType));
  if (mode != LIGHT_MODE_SPOT) {
    return rawDepth;
  }

  let near = 0.05;
  let far = max(8.0, max(4.0, light.range) * 1.45);
  return linearizePerspectiveDepthFloor(rawDepth, near, far);
}

fn findFloorBlockerDistance(
  uv: vec2<f32>,
  zReceiver: f32,
  searchRadius: f32,
  light: Light,
  lightIndex: i32
) -> vec2<f32> {
  let texelSize = shadowTexelSize(u.shadowParams);
  let sampleCount = min(i32(shadowParamZ(u.shadowParams)), 32);
  var blockerSum: f32 = 0.0;
  var numBlockers: f32 = 0.0;

  for (var i = 0; i < 32; i = i + 1) {
    if (i < sampleCount) {
      let offset = POISSON_64[i] * searchRadius * texelSize;
      let shadowMapDepth = pcssDepthForFloorLight(light, loadShadowDepthFloor(lightIndex, uv + offset));
      if (shadowMapDepth < zReceiver) {
        blockerSum += shadowMapDepth;
        numBlockers += 1.0;
      }
    }
  }

  if (numBlockers < 1.0) {
    return vec2<f32>(-1.0, 0.0);
  }

  return vec2<f32>(blockerSum / numBlockers, numBlockers);
}

fn samplePCSSFloor(lightSpacePos: vec4<f32>, light: Light, lightIndex: i32, bias: f32) -> f32 {
  let sample = makeUnbiasedShadowSample(lightSpacePos);
  let rawReceiverDepth = sample.depth;
  let zReceiver = pcssDepthForFloorLight(light, rawReceiverDepth);
  let searchWidth = clamp(shadowParamY(u.shadowParams) * mix(45.0, 130.0, zReceiver), 3.0, 32.0);
  let blockerInfo = findFloorBlockerDistance(sample.uv, zReceiver, searchWidth, light, lightIndex);
  let hasBlockers = blockerInfo.x >= 0.0;
  let penumbra = select(0.0, max((zReceiver - blockerInfo.x) * shadowParamY(u.shadowParams) / max(blockerInfo.x, 0.001), 0.0), hasBlockers);
  let filterRadius = clamp(1.0 + penumbra * 150.0, 1.0, 28.0);
  let texelSize = shadowTexelSize(u.shadowParams);
  let depth = rawReceiverDepth - bias;

  var shadow: f32 = 0.0;
  for (var i = 0; i < 16; i = i + 1) {
    let offset = POISSON_64[i] * filterRadius * texelSize;
    shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, lightIndex, depth);
  }

  let pcfResult = shadow / 16.0;
  let shadowResult = select(pcfResult, 1.0, !hasBlockers);
  return select(shadowResult, 1.0, !sample.inBounds);
}

fn shadowVisibilityFloor(lightSpacePos: vec4<f32>, light: Light, lightIndex: i32, bias: f32) -> f32 {
  let sample = makeShadowSample(lightSpacePos, bias);
  let method = shadowMethodIndex(shading);

  if (method == SHADOW_METHOD_VSM) {
    let unbiasedSample = makeUnbiasedShadowSample(lightSpacePos);
    let moments = textureSample(momentsTex, momentsSampler, unbiasedSample.uv, lightIndex).rg;
    let receiverDepth = pcssDepthForFloorLight(light, unbiasedSample.depth);
    let mean = moments.x;
    let meanSquare = moments.y;

    var visibility: f32 = 1.0;
    if (receiverDepth > mean) {
      let minVariance = shadowBias(u.shadowParams);
      let variance = max(meanSquare - mean * mean, minVariance);
      let d = receiverDepth - mean;
      let pMax = variance / (variance + d * d);
      let bleedReduction = shadowParamY(u.shadowParams);
      visibility = clamp((pMax - bleedReduction) / (1.0 - bleedReduction), 0.0, 1.0);
    }

    return select(visibility, 1.0, !unbiasedSample.inBounds);
  }

  if (method == SHADOW_METHOD_PCSS) {
    return samplePCSSFloor(lightSpacePos, light, lightIndex, bias);
  }

  var radius: f32;
  var samples: i32;
  var invSize: f32;

  if (method == SHADOW_METHOD_PCF) {
    // PCF: радиус и количество сэмплов из параметров
    radius = shadowParamY(u.shadowParams);     // pcfRadius
    samples = i32(shadowParamZ(u.shadowParams)); // pcfSamples
    invSize = shadowTexelSize(u.shadowParams);
  } else {
    // SM: один sample (жёсткие тени)
    radius = 0.0;
    samples = 1;
    invSize = shadowTexelSize(u.shadowParams);
  }

  let maxSamples = max(1, min(samples, 16));

  var shadow: f32 = 0.0;
  for (var i = 0; i < 16; i = i + 1) {
    if (i < maxSamples) {
      let offset = POISSON_16[i] * radius * invSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, lightIndex, sample.depth);
    }
  }
  shadow = shadow / f32(maxSamples);

  return select(shadow, 1.0, !sample.inBounds);
}

fn computeLightContributionFloor(
  N: vec3<f32>,
  worldPos: vec3<f32>,
  light: Light,
  isShadowed: bool,
  lightIndex: i32
) -> LightContribution {
  let L = computeLightDirection(light, worldPos);
  let lambert = max(dot(N, L), 0.0) * computeSpotFactor(light, worldPos) * computeDistanceFalloff(light, worldPos);

  var vis: f32 = 1.0;
  if (isShadowed && lightIndex >= 0) {
    let lsMat = shadowMats.mats[lightIndex];
    let bias = shadowBiasForLight(light, u.shadowParams);
    let biasedWorldPos = worldPos + N * receiverNormalBiasForLight(light, N, L, u.shadowParams);
    let biasedLightSpacePos = lsMat * vec4<f32>(biasedWorldPos, 1.0);
    let rawVisibility = shadowVisibilityFloor(biasedLightSpacePos, light, lightIndex, bias);
    vis = mixShadowStrength(rawVisibility, shading.shadowStrength);
  }

  let intensity = max(light.intensity, 0.0);
  return LightContribution(
    light.color * (lambert * vis * intensity),
    vec3<f32>(0.0),
    vis
  );
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
    let showGrid = gridParams.options.y;
    baseColor = mix(baseColor, gridLineColor, gridAlpha * showGrid);
  } else {
    baseColor = gridParams.wallColor;
  }

  let N = normalize(input.worldN);
  let worldPos = input.worldPos;
  let ambient = computeHemisphereAmbient(N, shading);

  let lightCount = i32(round(lightsData.count));
  var diffuseSum: vec3<f32> = vec3<f32>(0.0);
  var visibilitySum: f32 = 0.0;
  var activeCone: f32 = 0.0;
  var activeFalloff: f32 = 0.0;
  var activeVisibility: f32 = 1.0;
  let activeLightIndex = i32(round(shading.activeLightIndex));

  for (var i = 0; i < lightCount; i = i + 1) {
    let light = lightsData.lights[i];
    let lightIndex = i32(round(light.shadowIndex));
    let isShadowed = lightIndex >= 0;

    let contrib = computeLightContributionFloor(
      N,
      worldPos,
      light,
      isShadowed,
      lightIndex
    );
    diffuseSum = diffuseSum + contrib.diffuse;
    visibilitySum = visibilitySum + contrib.visibility;
    if (i == activeLightIndex) {
      activeCone = computeSpotFactor(light, worldPos);
      activeFalloff = computeDistanceFalloff(light, worldPos);
      activeVisibility = contrib.visibility;
    }
  }

  let diffuse = diffuseSum;
  let exposure = max(shading.exposure, 0.0);
  let debugMode = lightDebugModeIndex(shading);
  let lightCountF = max(f32(lightCount), 1.0);

  if (debugMode == LIGHT_DEBUG_LIGHTING) {
    return vec4<f32>(toneMap((ambient + diffuse) * exposure), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_DIFFUSE) {
    return vec4<f32>(toneMap(diffuseSum * exposure), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_SPECULAR) {
    return vec4<f32>(vec3<f32>(0.0), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_SHADOW) {
    let shadowMask = clamp(visibilitySum / lightCountF, 0.0, 1.0);
    return vec4<f32>(vec3<f32>(shadowMask), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_NORMALS) {
    return vec4<f32>(N * 0.5 + vec3<f32>(0.5), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_ACTIVE_CONE) {
    return vec4<f32>(vec3<f32>(activeCone), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_ACTIVE_FALLOFF) {
    return vec4<f32>(vec3<f32>(activeFalloff), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_ACTIVE_SHADOW) {
    return vec4<f32>(vec3<f32>(activeVisibility), 1.0);
  }

  let finalColor = toneMap(baseColor * (ambient + diffuse) * exposure);
  return vec4<f32>(finalColor, 1.0);
}
