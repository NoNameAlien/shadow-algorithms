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

struct ObjectParams {
  base: vec4<f32>, // xyz: color, w: receiveShadows
  spec: vec4<f32>, // x: specStrength, y: shininess
};

struct ShadowMatrices {
  count: f32,
  _pad0: vec3<f32>,
  mats: array<mat4x4<f32>, 2>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<uniform> objParams: ObjectParams;
@group(0) @binding(2) var<uniform> shadowMats: ShadowMatrices;

@group(2) @binding(0) var objTex: texture_2d<f32>;
@group(2) @binding(1) var objSampler: sampler;

@group(3) @binding(0) var<uniform> shading: ShadingParams;
@group(3) @binding(1) var<uniform> lightsData: LightsData;

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
