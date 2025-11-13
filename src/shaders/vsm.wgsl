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
  shadowParams: vec4<f32>, // x: minVariance, y: lightBleedReduction
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@group(1) @binding(0) var momentsTex: texture_2d<f32>;
@group(1) @binding(1) var momentsSampler: sampler;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4<f32>(input.position, 1.0);
  out.clipPos = u.viewProj * world;
  let nWorld = (u.model * vec4<f32>(input.normal, 0.0)).xyz;
  out.worldN = normalize(nWorld);
  out.worldPos = world.xyz;
  out.lightSpacePos = u.lightViewProj * world;
  return out;
}

fn chebyshevUpperBound(moments: vec2<f32>, t: f32) -> f32 {
  let mean = moments.x;
  let meanSquare = moments.y;
  
  // Если приёмник ближе средней глубины — полностью освещён
  if (t <= mean) {
    return 1.0;
  }
  
  // Variance = E[X²] - E[X]²
  let minVariance = u.shadowParams.x;
  var variance = max(meanSquare - mean * mean, minVariance);
  
  // Chebyshev: P(X >= t) <= σ² / (σ² + (t - μ)²)
  let d = t - mean;
  var pMax = variance / (variance + d * d);
  
  // Light bleeding reduction: линейное сжатие
  let bleedReduction = u.shadowParams.y;
  pMax = clamp((pMax - bleedReduction) / (1.0 - bleedReduction), 0.0, 1.0);
  
  return pMax;
}

fn shadowVisibilityVSM(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
  let depth = ndc.z;
  
  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 && 
                 ndc.y >= -1.0 && ndc.y <= 1.0 && 
                 ndc.z >= 0.0 && ndc.z <= 1.0;
  
  // ВСЕГДА читаем моменты (uniform control flow)
  let moments = textureSample(momentsTex, momentsSampler, uv).rg;
  let visibility = chebyshevUpperBound(moments, depth);
  
  // Возвращаем 1.0 если вне границ, иначе результат VSM
  return select(visibility, 1.0, !inBounds);
}


@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(input.worldN);
  let L = normalize(u.lightDir.xyz);
  let lambert = max(dot(N, L), 0.0);
  
  let visibility = shadowVisibilityVSM(input.lightSpacePos);
  
  let baseColor = vec3<f32>(0.55, 0.57, 0.6);
  let ambient = 0.55;
  let diffuse = (1.0 - ambient) * lambert * visibility;
  let finalColor = baseColor * clamp(ambient + diffuse, 0.0, 1.0);
  return vec4<f32>(finalColor, 1.0);
}

