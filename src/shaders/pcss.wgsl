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
  shadowParams: vec4<f32>, // x: bias, y: lightSize, z: blockerSearchSamples, w: shadowMapSize
};
@group(0) @binding(0) var<uniform> u: Uniforms;

const PI: f32 = 3.14159265;
const LIGHT_MODE_SUN: i32 = 0;
const LIGHT_MODE_SPOT: i32 = 1;
const LIGHT_MODE_TOP: i32 = 2;

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;
@group(1) @binding(2) var shadowSamplerLinear: sampler;

@group(2) @binding(0) var objTex: texture_2d<f32>;
@group(2) @binding(1) var objSampler: sampler;

struct ShadingParams {
  shadowStrength: f32,
  lightMode: f32,
  spotYaw: f32,
  spotPitch: f32,
};

@group(3) @binding(0) var<uniform> shading: ShadingParams;

const POISSON_64: array<vec2<f32>, 64> = array<vec2<f32>, 64>(
  vec2<f32>(-0.613, 0.354), vec2<f32>(0.743, -0.125), vec2<f32>(-0.212, -0.532), vec2<f32>(0.124, 0.987),
  vec2<f32>(-0.945, -0.123), vec2<f32>(0.432, 0.456), vec2<f32>(-0.321, 0.765), vec2<f32>(0.876, 0.321),
  vec2<f32>(-0.111, -0.987), vec2<f32>(0.234, -0.654), vec2<f32>(-0.765, 0.111), vec2<f32>(0.567, -0.876),
  vec2<f32>(-0.456, -0.234), vec2<f32>(0.789, 0.654), vec2<f32>(-0.888, 0.444), vec2<f32>(0.111, -0.111),
  vec2<f32>(0.345, 0.234), vec2<f32>(-0.567, 0.678), vec2<f32>(0.234, -0.345), vec2<f32>(-0.123, 0.567),
  vec2<f32>(0.678, -0.234), vec2<f32>(-0.345, -0.567), vec2<f32>(0.456, 0.123), vec2<f32>(-0.678, 0.345),
  vec2<f32>(0.567, 0.678), vec2<f32>(-0.234, 0.456), vec2<f32>(0.345, -0.123), vec2<f32>(-0.456, 0.234),
  vec2<f32>(0.123, -0.678), vec2<f32>(-0.567, 0.345), vec2<f32>(0.678, 0.456), vec2<f32>(-0.345, -0.678),
  vec2<f32>(0.234, 0.345), vec2<f32>(-0.123, -0.456), vec2<f32>(0.567, -0.234), vec2<f32>(-0.678, 0.123),
  vec2<f32>(0.456, -0.567), vec2<f32>(-0.234, 0.678), vec2<f32>(0.345, -0.678), vec2<f32>(-0.456, 0.234),
  vec2<f32>(0.123, 0.567), vec2<f32>(-0.345, -0.123), vec2<f32>(0.678, 0.234), vec2<f32>(-0.567, -0.345),
  vec2<f32>(0.456, 0.678), vec2<f32>(-0.234, -0.567), vec2<f32>(0.345, 0.123), vec2<f32>(-0.678, -0.456),
  vec2<f32>(-0.789, 0.234), vec2<f32>(0.567, -0.345), vec2<f32>(-0.123, 0.789), vec2<f32>(0.345, -0.567),
  vec2<f32>(-0.234, -0.789), vec2<f32>(0.123, 0.456), vec2<f32>(-0.567, 0.345), vec2<f32>(0.789, -0.123),
  vec2<f32>(-0.345, 0.567), vec2<f32>(0.234, -0.678), vec2<f32>(-0.456, 0.789), vec2<f32>(0.567, -0.234),
  vec2<f32>(-0.678, -0.345), vec2<f32>(0.456, 0.123), vec2<f32>(-0.789, 0.678), vec2<f32>(0.234, -0.456)
);

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4<f32>(input.position, 1.0);
  out.clipPos = u.viewProj * world;
  let nWorld = (u.model * vec4<f32>(input.normal, 0.0)).xyz;
  out.worldN = normalize(nWorld);
  out.worldPos = world.xyz;
  out.lightSpacePos = u.lightViewProj * world;
  out.uv = input.uv;
  return out;
}

fn findBlockerDistance(uv: vec2<f32>, zReceiver: f32, searchRadius: f32) -> vec2<f32> {
  let texelSize = 1.0 / u.shadowParams.w;
  let sampleCount = i32(u.shadowParams.z);
  
  var blockerSum: f32 = 0.0;
  var numBlockers: f32 = 0.0;
  
  // ФИКСИРОВАННЫЙ цикл — максимум 8 сэмплов для blocker search
  let maxSamples = min(sampleCount, 8);
  for (var i = 0; i < 8; i = i + 1) {
    if (i < maxSamples) {
      let offset = POISSON_64[i] * searchRadius * texelSize;
      let shadowMapDepth = textureSampleLevel(shadowMap, shadowSamplerLinear, uv + offset, 0);
      
      if (shadowMapDepth < zReceiver) {
        blockerSum += shadowMapDepth;
        numBlockers += 1.0;
      }
    }
  }
  
  if (numBlockers < 1.0) {
    return vec2<f32>(-1.0, 0.0);
  }
  
  let avgBlockerDepth = blockerSum / numBlockers;
  return vec2<f32>(avgBlockerDepth, numBlockers);
}

fn pcfFilter(uv: vec2<f32>, zReceiver: f32, filterRadius: f32) -> f32 {
  let texelSize = 1.0 / u.shadowParams.w;
  let depth = zReceiver - u.shadowParams.x;
  
  var shadow: f32 = 0.0;
  
  for (var i = 0; i < 16; i = i + 1) {
    let offset = POISSON_64[i] * filterRadius * texelSize;
    shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
  }
  
  return shadow / 16.0;
}


fn penumbraSize(zReceiver: f32, zBlocker: f32) -> f32 {
  let lightSize = u.shadowParams.y;
  return max((zReceiver - zBlocker) * lightSize / zBlocker, 0.0);
}

fn shadowVisibilityPCSS(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
  let zReceiver = ndc.z;
  
  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 && 
                 ndc.y >= -1.0 && ndc.y <= 1.0 && 
                 ndc.z >= 0.0 && ndc.z <= 1.0;
  
  // ВСЕГДА выполняем поиск блокеров (uniform control flow)
  let searchWidth = u.shadowParams.y * 2.0;
  let blockerInfo = findBlockerDistance(uv, zReceiver, searchWidth);
  
  // Проверяем наличие блокеров
  let hasBlockers = blockerInfo.x >= 0.0;
  
  // Если есть блокеры, вычисляем радиус полутени, иначе 0
  let penumbra = select(0.0, penumbraSize(zReceiver, blockerInfo.x), hasBlockers);
  let filterRadius = max(penumbra * 50.0, 1.0);
  
  // ВСЕГДА выполняем PCF (uniform control flow)
  let pcfResult = pcfFilter(uv, zReceiver, filterRadius);
  
  // Если нет блокеров → 1.0 (полностью освещено)
  // Если есть блокеры → результат PCF
  let shadowResult = select(pcfResult, 1.0, !hasBlockers);
  
  // Если вне границ → 1.0, иначе результат теней
  return select(shadowResult, 1.0, !inBounds);
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(input.worldN);
  let lightPos = u.lightDir.xyz;

  let mode = i32(round(shading.lightMode));

  var L: vec3<f32>;
  var lambert: f32;

  if (mode == LIGHT_MODE_TOP) {
    L = normalize(vec3<f32>(0.0, -1.0, 0.0));
    lambert = max(dot(N, L), 0.0);
  } else if (mode == LIGHT_MODE_SPOT) {
    let yaw = shading.spotYaw;
    let pitch = shading.spotPitch;
    let axis = vec3<f32>(
      cos(pitch) * sin(yaw),
      sin(pitch),
      cos(pitch) * cos(yaw)
    );
    let toFrag = normalize(input.worldPos - lightPos);
    L = normalize(lightPos - input.worldPos);

    lambert = max(dot(N, L), 0.0);

    let cosAngle = dot(toFrag, axis);
    let innerDeg: f32 = 15.0;
    let outerDeg: f32 = 25.0;
    let inner = cos(innerDeg * PI / 180.0);
    let outer = cos(outerDeg * PI / 180.0);
    let tSpot = clamp((cosAngle - outer) / (inner - outer), 0.0, 1.0);
    lambert = lambert * tSpot;
  } else {
    L = normalize(lightPos);
    lambert = max(dot(N, L), 0.0);
  }

  let rawVisibility = shadowVisibilityPCSS(input.lightSpacePos);

  // Цвет объекта из текстуры
  var baseColor = vec3<f32>(0.55, 0.57, 0.6);
  let texColor = textureSample(objTex, objSampler, input.uv).xyz;
  baseColor = mix(baseColor, texColor, 1.0);

  let ambient = 0.55;

  let strength = clamp(shading.shadowStrength, 0.0, 2.0);

  let t = clamp(strength, 0.0, 1.0);
  var vis = mix(1.0, rawVisibility, t);

  if (strength > 1.0) {
    let extra = strength - 1.0;
    vis = max(0.0, vis * (1.0 - extra));
  }

  let diffuse = (1.0 - ambient) * lambert * vis;
  let finalColor = baseColor * clamp(ambient + diffuse, 0.0, 1.0);
  return vec4<f32>(finalColor, 1.0);
}
