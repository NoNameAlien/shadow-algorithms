struct VSIn {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldN: vec3<f32>,
};

struct Uniforms {
  model: mat4x4<f32>,
  viewProj: mat4x4<f32>,
  lightDir: vec4<f32>, // xyz + pad
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4<f32>(input.position, 1.0);
  out.clipPos = u.viewProj * world;
  // Нормали: трансформация только вращением/без масштаба
  let nWorld = (u.model * vec4<f32>(input.normal, 0.0)).xyz;
  out.worldN = normalize(nWorld);
  out.worldPos = world.xyz;
  return out;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(input.worldN);
  let L = normalize(u.lightDir.xyz);
  let lambert = max(dot(N, -L), 0.0);
  let baseColor = vec3<f32>(0.75, 0.78, 0.82);
  let color = baseColor * (0.1 + 0.9 * lambert);
  return vec4<f32>(color, 1.0);
}
