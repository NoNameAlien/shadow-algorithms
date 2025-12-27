struct VSIn {
  @location(0) position : vec3<f32>,
  @location(1) color    : vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos : vec4<f32>,
  @location(0) color         : vec3<f32>,
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

  let translation = vec3<f32>(u.model[3].x, u.model[3].y, u.model[3].z);

  var worldPos = input.position + translation;

  let floorY: f32 = -2.5;

  // Для отрицательной части зелёной оси (Y) дотягиваем до пола:
  // зелёная ось: X=0, Z=0; низ оси — vertex с y < 0
  if (input.position.x == 0.0 && input.position.z == 0.0 && input.position.y < 0.0) {
    worldPos = vec3<f32>(translation.x, floorY, translation.z);
  }

  out.clipPos = u.viewProj * vec4<f32>(worldPos, 1.0);
  out.color = input.color;
  return out;
}


@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color, 1.0);
}
