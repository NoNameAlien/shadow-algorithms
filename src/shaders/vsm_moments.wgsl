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

fn linearizePerspectiveDepth(depth: f32, near: f32, far: f32) -> f32 {
  let distance = (near * far) / max(far - depth * (far - near), 0.000001);
  return clamp((distance - near) / max(far - near, 0.000001), 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let rawDepth = clamp(fragCoord.z, 0.0, 1.0);
  let near = u.shadowParams.z;
  let far = u.shadowParams.w;
  let depth = select(rawDepth, linearizePerspectiveDepth(rawDepth, near, far), far > near && near > 0.0);
  let dx = dpdx(depth);
  let dy = dpdy(depth);
  let moment1 = depth;
  let moment2 = depth * depth + 0.25 * (dx * dx + dy * dy);
  // Храним моменты в RG каналах
  return vec4<f32>(moment1, moment2, 0.0, 1.0);
}
