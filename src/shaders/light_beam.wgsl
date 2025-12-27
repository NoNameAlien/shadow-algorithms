struct VSIn {
  @location(0) position: vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
};

struct Uniforms {
  model: mat4x4<f32>,
  viewProj: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  lightDir: vec4<f32>,
  cameraPos: vec4<f32>,
  shadowParams: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out : VSOut;
  // Позиция вершины уже в мировых координатах
  let worldPos = input.position;
  out.clipPos = u.viewProj * vec4<f32>(worldPos, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  // тёплый полупрозрачный луч
  return vec4<f32>(1.0, 0.9, 0.3, 0.6);
}
