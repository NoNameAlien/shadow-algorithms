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

@vertex
fn vs_main(input: VSIn) -> @builtin(position) vec4<f32> {
  let world = u.model * vec4<f32>(input.position, 1.0);
  return u.lightViewProj * world;
}
