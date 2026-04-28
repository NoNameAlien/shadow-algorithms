// @include object_common

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

// @include poisson64

fn shadowVisibility(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = ndcToUv(ndc);
  let depth = ndc.z - u.shadowParams.x;
  let inBounds = isInBounds(ndc);
  
  let texelSize = 1.0 / u.shadowParams.w;
  let radius = u.shadowParams.y;
  let sampleCount = i32(u.shadowParams.z);
  
  var shadow: f32 = 0.0;
  
  // Оптимизация: используем только нужное количество сэмплов
  let maxSamples = min(sampleCount, 32);
  
  // Разворачиваем цикл для скорости
  if (maxSamples <= 4) {
    for (var i = 0; i < 4; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 4.0;
  } else if (maxSamples <= 8) {
    for (var i = 0; i < 8; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 8.0;
  } else if (maxSamples <= 16) {
    for (var i = 0; i < 16; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 16.0;
  } else {
    for (var i = 0; i < 32; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
    }
    shadow /= 32.0;
  }
  
  return select(shadow, 1.0, !inBounds);
}

// @include object_single_shadow_main
