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

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) depth: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4<f32>(input.position, 1.0);
  let lightSpace = u.lightViewProj * world;
  out.position = lightSpace;
  out.depth = lightSpace.z / lightSpace.w;
  return out;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let depth = clamp(input.depth, 0.0, 1.0);
  return vec4<f32>(depth, depth * depth, 0.0, 1.0);
}
