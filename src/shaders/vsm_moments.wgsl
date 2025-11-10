struct VSIn {
  @location(0) position: vec3<f32>,
};

struct Uniforms {
  model: mat4x4<f32>,
  viewProj: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  lightDir: vec4<f32>,
  shadowParams: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) depth: f32,
};

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4<f32>(input.position, 1.0);
  let lightSpace = u.lightViewProj * world;
  out.position = lightSpace;
  // Линейная глубина в [0,1]
  out.depth = lightSpace.z / lightSpace.w;
  return out;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let depth = input.depth;
  let moment1 = depth;
  let moment2 = depth * depth;
  // Храним моменты в RG каналах
  return vec4<f32>(moment1, moment2, 0.0, 1.0);
}
