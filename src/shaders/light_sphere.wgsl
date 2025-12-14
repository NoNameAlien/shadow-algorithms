struct VSIn {
  @location(0) position : vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos : vec4<f32>,
};

struct Uniforms {
  model        : mat4x4<f32>,
  viewProj     : mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  lightDir     : vec4<f32>,
  shadowParams : vec4<f32>,
};

@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out : VSOut;
  let lightPos = u.lightDir.xyz;
  let worldPos = input.position + lightPos;
  out.clipPos = u.viewProj * vec4<f32>(worldPos, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  // Можно чуть отличать цвет по режиму, но это не обязательно
  return vec4<f32>(1.0, 0.9, 0.3, 1.0);
}
