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

struct ObjectParams {
  base: vec4<f32>, // xyz: color, w: receiveShadows
  spec: vec4<f32>, // x: specStrength, y: shininess
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<uniform> objParams: ObjectParams;

const PI: f32 = 3.14159265;
const LIGHT_MODE_SUN: i32 = 0;
const LIGHT_MODE_SPOT: i32 = 1;
const LIGHT_MODE_TOP: i32 = 2;

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

@group(2) @binding(0) var objTex: texture_2d<f32>;
@group(2) @binding(1) var objSampler: sampler;

struct ShadingParams {
  shadowStrength: f32,
  lightMode: f32,
  spotYaw: f32,
  spotPitch: f32,
  methodIndex: f32,
  lightIntensity: f32,
  shadowCaster: f32,
  _pad2: f32,
};

struct Light {
  pos: vec3<f32>,
  lightType: f32,
  yaw: f32,
  pitch: f32,
  intensity: f32,
  color: vec3<f32>,
};

struct LightsData {
  count: f32,
  _pad0: vec3<f32>,
  lights: array<Light, 4>,
};

@group(3) @binding(0) var<uniform> shading: ShadingParams;
@group(3) @binding(1) var<uniform> lightsData: LightsData;

// Poisson disk - используем максимум 64 сэмпла (можно меньше через uniform)
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

fn shadowVisibilityPCF(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
  let depth = ndc.z - u.shadowParams.x;
  
  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 && 
                 ndc.y >= -1.0 && ndc.y <= 1.0 && 
                 ndc.z >= 0.0 && ndc.z <= 1.0;
  
  let texelSize = 1.0 / u.shadowParams.w;
  let radius = u.shadowParams.y;
  let sampleCount = i32(u.shadowParams.z);
  
  var shadow: f32 = 0.0;
  
  // Оптимизация: используем только нужное количество сэмплов
  let maxSamples = min(sampleCount, 32);
  
  // Разворачиваем цикл для скорости
  if (maxSamples <= 4) {
    for (var i = 0; i < 4; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 4.0;
  } else if (maxSamples <= 8) {
    for (var i = 0; i < 8; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 8.0;
  } else if (maxSamples <= 16) {
    for (var i = 0; i < 16; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 16.0;
  } else {
    for (var i = 0; i < 32; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 32.0;
  }
  
  return select(shadow, 1.0, !inBounds);
}

fn computeLightContribution(
  N: vec3<f32>,
  worldPos: vec3<f32>,
  light: Light,
  isShadowed: bool,
  lightSpacePos: vec4<f32>
) -> f32 {
  let lightPos = light.pos;
  let mode = i32(round(light.lightType));

  var L: vec3<f32>;
  var lambert: f32;

  if (mode == LIGHT_MODE_TOP) {
    L = normalize(vec3<f32>(0.0, 1.0, 0.0));
    lambert = max(dot(N, L), 0.0);
  } else if (mode == LIGHT_MODE_SPOT) {
    let yaw = light.yaw;
    let pitch = light.pitch;
    let axis = vec3<f32>(
      cos(pitch) * sin(yaw),
      sin(pitch),
      cos(pitch) * cos(yaw)
    );

    let toFrag = normalize(worldPos - lightPos);
    L = normalize(lightPos - worldPos);
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

  var vis: f32 = 1.0;
  if (isShadowed) {
    let rawVisibility = shadowVisibilityPCF(lightSpacePos);

    let strength = clamp(shading.shadowStrength, 0.0, 2.0);
    let t = clamp(strength, 0.0, 1.0);
    vis = mix(1.0, rawVisibility, t);

    if (strength > 1.0) {
      let extra = strength - 1.0;
      vis = max(0.0, vis * (1.0 - extra));
    }
  }

  // Спекуляр (Blinn-Phong)
  let viewDir = normalize(u.cameraPos.xyz - worldPos);
  let halfVec = normalize(L + viewDir);
  let specAngle = max(dot(N, halfVec), 0.0);
  let shininess = max(objParams.spec.y, 1.0);
  let specular = pow(specAngle, shininess);

  let intensity = max(light.intensity, 0.0);
  let diffuseTerm = lambert * vis * intensity;
  let specFactor = max(objParams.spec.x, 0.0);
  let specTerm = specular * vis * intensity * specFactor;

  return diffuseTerm + specTerm;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(input.worldN);
  let worldPos = input.worldPos;

  // Цвет объекта из текстуры
  var baseColor = objParams.base.xyz;
  let texColor = textureSample(objTex, objSampler, input.uv).xyz;
  baseColor = baseColor * texColor;

  let ambient = 0.55;

  let lightCount = i32(round(lightsData.count));
  var diffuseSum: vec3<f32> = vec3<f32>(0.0);
  let caster = i32(round(shading.shadowCaster));
  let receive = objParams.base.w;

  for (var i = 0; i < lightCount; i = i + 1) {
    let light = lightsData.lights[i];
    let isShadowed = (i == caster) && (receive > 0.5);

    let contrib = computeLightContribution(
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
