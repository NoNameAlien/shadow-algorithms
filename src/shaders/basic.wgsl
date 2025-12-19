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

const PI: f32 = 3.14159265;
const LIGHT_MODE_SUN: i32 = 0;
const LIGHT_MODE_SPOT: i32 = 1;
const LIGHT_MODE_TOP: i32 = 2;

@group(0) @binding(0) var<uniform> u: Uniforms;

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
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(3) @binding(0) var<uniform> shading: ShadingParams;


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

fn shadowVisibility(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
  let depth = ndc.z - u.shadowParams.x;
  
  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 && 
                 ndc.y >= -1.0 && ndc.y <= 1.0 && 
                 ndc.z >= 0.0 && ndc.z <= 1.0;
  
  let shadow = textureSampleCompare(shadowMap, shadowSampler, uv, depth);
  return select(shadow, 1.0, !inBounds);
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
    let N = normalize(input.worldN);
  let lightPos = u.lightDir.xyz;

  let mode = i32(round(shading.lightMode)); // 0=sun,1=spot,2=top

  var L: vec3<f32>;
  var lambert: f32;

    if (mode == LIGHT_MODE_TOP) {
    // Верхний свет: идёт СВЕРХУ, значит направление к свету для фрагмента — вверх
    L = normalize(vec3<f32>(0.0, 1.0, 0.0));
    lambert = max(dot(N, L), 0.0);
  } else if (mode == LIGHT_MODE_SPOT) {
    // Прожектор: позиция фиксирована, направление задаётся yaw/pitch
    let yaw = shading.spotYaw;
    let pitch = shading.spotPitch;

    // Ось прожектора (из света в сцену)
    let axis = vec3<f32>(
      cos(pitch) * sin(yaw),
      sin(pitch),
      cos(pitch) * cos(yaw)
    );

    // Направление к фрагменту из света и наоборот
    let toFrag = normalize(input.worldPos - lightPos);   // из света к фрагменту
    L = normalize(lightPos - input.worldPos);            // из фрагмента к свету

    lambert = max(dot(N, L), 0.0);

    // Spot falloff по углу между осью и направлением к фрагменту
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

  let rawVisibility = shadowVisibility(input.lightSpacePos);

  // Цвет объекта из текстуры (sRGB можно игнорировать для простоты)
  var baseColor = vec3<f32>(0.55, 0.57, 0.6);
  let texColor = textureSample(objTex, objSampler, input.uv).xyz;
  baseColor = mix(baseColor, texColor, 1.0);

  let ambient = 0.55;

  // strength: 0..2
  let strength = clamp(shading.shadowStrength, 0.0, 2.0);

  // 0..1 — ослабляем тени, плавно двигая vis от 1 к rawVisibility
  let t = clamp(strength, 0.0, 1.0);
  var vis = mix(1.0, rawVisibility, t);

  // 1..2 — усиливаем тени: дополнительно тянем vis к 0
  if (strength > 1.0) {
    let extra = strength - 1.0;           // 0..1
    vis = max(0.0, vis * (1.0 - extra));  // при 2 → vis ~ 0
  }

  let diffuse = (1.0 - ambient) * lambert * vis;
  let finalColor = baseColor * clamp(ambient + diffuse, 0.0, 1.0);
  return vec4<f32>(finalColor, 1.0);
}
