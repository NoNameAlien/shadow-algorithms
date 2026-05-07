struct VSIn {
  @location(0) position: vec3<f32>,
};

struct Uniforms {
  model: mat4x4<f32>,
  viewProj: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  lightDir: vec4<f32>,
  cameraPos: vec4<f32>,
  shadowParams: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4<f32>(input.position, 1.0);
  out.position = u.lightViewProj * world;
  return out;
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let depth = clamp(fragCoord.z, 0.0, 1.0);
  let dx = dpdx(depth);
  let dy = dpdy(depth);
  let moment1 = depth;
  let moment2 = depth * depth + 0.25 * (dx * dx + dy * dy);
  // Храним моменты в RG каналах
  return vec4<f32>(moment1, moment2, 0.0, 1.0);
}
