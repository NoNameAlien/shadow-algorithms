struct VSIn {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldN: vec3<f32>,
  @location(2) lightSpacePos: vec4<f32>,
};

struct Uniforms {
  model: mat4x4<f32>,
  viewProj: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  lightDir: vec4<f32>,
  shadowParams: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  // Grid не вращается (identity model matrix)
  out.clipPos = u.viewProj * vec4<f32>(input.position, 1.0);
  out.worldN = input.normal;
  out.worldPos = input.position;
  out.lightSpacePos = u.lightViewProj * vec4<f32>(input.position, 1.0);
  return out;
}

fn shadowVisibility(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = ndc.xy * 0.5 + vec2<f32>(0.5);
  let depth = ndc.z - u.shadowParams.x;
  
  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 && 
                 ndc.y >= -1.0 && ndc.y <= 1.0 && 
                 ndc.z >= 0.0 && ndc.z <= 1.0;
  
  let shadow = textureSampleCompare(shadowMap, shadowSampler, uv, depth);
  return select(shadow, 1.0, !inBounds);
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  // Процедурная сетка (линии)
  let gridSize = 1.0;
  let coord = input.worldPos.xz / gridSize;
  let grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  let line = min(grid.x, grid.y);
  let gridAlpha = 1.0 - min(line, 1.0);
  
  // Освещение для grid
  let N = normalize(input.worldN);
  let L = normalize(u.lightDir.xyz);
  let lambert = max(dot(N, L), 0.0);
  let visibility = shadowVisibility(input.lightSpacePos);
  
  // Цвет сетки
  let gridColor = vec3<f32>(0.3, 0.35, 0.4);
  let baseColor = vec3<f32>(0.15, 0.16, 0.18); // темнее для фона
  
  // Смешиваем сетку с фоном
  let color = mix(baseColor, gridColor, gridAlpha);
  
  // Применяем освещение
  let ambient = 0.6;
  let diffuse = (1.0 - ambient) * lambert * visibility;
  let finalColor = color * clamp(ambient + diffuse, 0.0, 1.0);
  
  // Затухание с расстоянием
  let dist = length(input.worldPos.xz);
  let fade = 1.0 - smoothstep(8.0, 20.0, dist);
  
  return vec4<f32>(finalColor, fade);
}
