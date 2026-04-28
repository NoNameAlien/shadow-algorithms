// @include object_common

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

// @include poisson64

fn findBlockerDistance(uv: vec2<f32>, zReceiver: f32, searchRadius: f32) -> vec2<f32> {
  let texelSize = shadowTexelSize(u.shadowParams);
  let sampleCount = i32(shadowParamZ(u.shadowParams));
  
  var blockerSum: f32 = 0.0;
  var numBlockers: f32 = 0.0;
  
  // ФИКСИРОВАННЫЙ цикл — максимум 8 сэмплов для blocker search
  let maxSamples = min(sampleCount, 8);
  for (var i = 0; i < 8; i = i + 1) {
    if (i < maxSamples) {
      let offset = POISSON_64[i] * searchRadius * texelSize;
      let coords = vec2<i32>(uv * shadowMapSize(u.shadowParams));
      let shadowMapDepth = textureLoad(shadowMap, coords, 0);
      
      if (shadowMapDepth < zReceiver) {
        blockerSum += shadowMapDepth;
        numBlockers += 1.0;
      }
    }
  }
  
  if (numBlockers < 1.0) {
    return vec2<f32>(-1.0, 0.0);
  }
  
  let avgBlockerDepth = blockerSum / numBlockers;
  return vec2<f32>(avgBlockerDepth, numBlockers);
}

fn pcfFilter(uv: vec2<f32>, zReceiver: f32, filterRadius: f32) -> f32 {
  let texelSize = shadowTexelSize(u.shadowParams);
  let depth = zReceiver - shadowBias(u.shadowParams);
  
  var shadow: f32 = 0.0;
  
  for (var i = 0; i < 16; i = i + 1) {
    let offset = POISSON_64[i] * filterRadius * texelSize;
    shadow += textureSampleCompare(shadowMap, shadowSampler, uv + offset, depth);
  }
  
  return shadow / 16.0;
}


fn penumbraSize(zReceiver: f32, zBlocker: f32) -> f32 {
  let lightSize = shadowParamY(u.shadowParams);
  return max((zReceiver - zBlocker) * lightSize / zBlocker, 0.0);
}

fn shadowVisibility(lightSpacePos: vec4<f32>) -> f32 {
  let sample = makeUnbiasedShadowSample(lightSpacePos);
  let zReceiver = sample.depth;
  
  // ВСЕГДА выполняем поиск блокеров (uniform control flow)
  let searchWidth = shadowParamY(u.shadowParams) * 2.0;
  let blockerInfo = findBlockerDistance(sample.uv, zReceiver, searchWidth);
  
  // Проверяем наличие блокеров
  let hasBlockers = blockerInfo.x >= 0.0;
  
  // Если есть блокеры, вычисляем радиус полутени, иначе 0
  let penumbra = select(0.0, penumbraSize(zReceiver, blockerInfo.x), hasBlockers);
  let filterRadius = max(penumbra * 50.0, 1.0);
  
  // ВСЕГДА выполняем PCF (uniform control flow)
  let pcfResult = pcfFilter(sample.uv, zReceiver, filterRadius);
  
  // Если нет блокеров → 1.0 (полностью освещено)
  // Если есть блокеры → результат PCF
  let shadowResult = select(pcfResult, 1.0, !hasBlockers);
  
  // Если вне границ → 1.0, иначе результат теней
  return select(shadowResult, 1.0, !sample.inBounds);
}

// @include object_single_shadow_main
