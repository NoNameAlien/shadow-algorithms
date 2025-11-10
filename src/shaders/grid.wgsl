struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};

struct Uniforms {
  viewProj: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@location(0) position: vec3<f32>) -> VSOut {
  var out: VSOut;
  out.position = u.viewProj * vec4<f32>(position, 1.0);
  out.worldPos = position;
  return out;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  // Процедурная сетка
  let gridSize = 1.0;
  let lineWidth = 0.02;
  
  let coord = input.worldPos.xz / gridSize;
  let grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  let line = min(grid.x, grid.y);
  
  let alpha = 1.0 - min(line, 1.0);
  let color = vec3<f32>(0.2, 0.25, 0.3); // темно-серая сетка
  
  // Затухание с расстоянием
  let dist = length(input.worldPos);
  let fade = 1.0 - smoothstep(5.0, 15.0, dist);
  
  return vec4<f32>(color, alpha * fade * 0.3); // полупрозрачность
}
