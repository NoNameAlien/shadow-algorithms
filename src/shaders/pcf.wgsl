// @include object_common

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

// @include poisson64

fn shadowVisibility(lightSpacePos: vec4<f32>) -> f32 {
  let sample = makeShadowSample(lightSpacePos, shadowBias(u.shadowParams));
  
  let texelSize = shadowTexelSize(u.shadowParams);
  let radius = shadowParamY(u.shadowParams);
  let sampleCount = i32(shadowParamZ(u.shadowParams));
  
  var shadow: f32 = 0.0;
  
  // Оптимизация: используем только нужное количество сэмплов
  let maxSamples = min(sampleCount, 32);
  
  // Разворачиваем цикл для скорости
  if (maxSamples <= 4) {
    for (var i = 0; i < 4; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, sample.depth);
    }
    shadow /= 4.0;
  } else if (maxSamples <= 8) {
    for (var i = 0; i < 8; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, sample.depth);
    }
    shadow /= 8.0;
  } else if (maxSamples <= 16) {
    for (var i = 0; i < 16; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, sample.depth);
    }
    shadow /= 16.0;
  } else {
    for (var i = 0; i < 32; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, sample.depth);
    }
    shadow /= 32.0;
  }
  
  return select(shadow, 1.0, !sample.inBounds);
}

// @include object_single_shadow_main
