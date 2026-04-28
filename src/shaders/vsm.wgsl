// @include object_common

@group(1) @binding(0) var momentsTex: texture_2d<f32>;
@group(1) @binding(1) var momentsSampler: sampler;

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

fn shadowVisibility(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = ndcToUv(ndc);
  let depth = ndc.z;
  let inBounds = isInBounds(ndc);
  
  // ВСЕГДА читаем моменты (uniform control flow)
  let moments = textureSample(momentsTex, momentsSampler, uv).rg;
  let visibility = chebyshevUpperBound(moments, depth);
  
  // Возвращаем 1.0 если вне границ, иначе результат VSM
  return select(visibility, 1.0, !inBounds);
}

// @include object_single_shadow_main
