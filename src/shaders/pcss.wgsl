// @include object_common

@group(1) @binding(0) var shadowMap: texture_depth_2d_array;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

// @include poisson64

fn loadShadowDepth(lightIndex: i32, uv: vec2<f32>) -> f32 {
  let size = i32(shadowMapSize(u.shadowParams));
  let coords = clamp(vec2<i32>(uv * f32(size)), vec2<i32>(0), vec2<i32>(size - 1));
  return textureLoad(shadowMap, coords, lightIndex, 0);
}

fn compareShadow(lightIndex: i32, uv: vec2<f32>, depth: f32) -> f32 {
  return textureSampleCompare(shadowMap, shadowSampler, uv, lightIndex, depth);
}

fn linearizePerspectiveDepth(depth: f32, near: f32, far: f32) -> f32 {
  let distance = (near * far) / max(far - depth * (far - near), 0.000001);
  return clamp((distance - near) / max(far - near, 0.000001), 0.0, 1.0);
}

fn pcssDepthForLight(light: Light, rawDepth: f32) -> f32 {
  let mode = i32(round(light.lightType));
  if (mode != LIGHT_MODE_SPOT) {
    return rawDepth;
  }

  let near = 0.05;
  let far = max(8.0, max(4.0, light.range) * 1.45);
  return linearizePerspectiveDepth(rawDepth, near, far);
}

fn findBlockerDistance(
  uv: vec2<f32>,
  zReceiver: f32,
  searchRadius: f32,
  light: Light,
  lightIndex: i32
) -> vec2<f32> {
  let texelSize = shadowTexelSize(u.shadowParams);
  let sampleCount = i32(shadowParamZ(u.shadowParams));
  
  var blockerSum: f32 = 0.0;
  var numBlockers: f32 = 0.0;
  
  let maxSamples = min(sampleCount, 32);
  for (var i = 0; i < 32; i = i + 1) {
    if (i < maxSamples) {
      let offset = POISSON_64[i] * searchRadius * texelSize;
      let shadowMapDepth = pcssDepthForLight(light, loadShadowDepth(lightIndex, uv + offset));
      
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

fn pcfFilter(uv: vec2<f32>, rawReceiverDepth: f32, filterRadius: f32, lightIndex: i32, bias: f32) -> f32 {
  let texelSize = shadowTexelSize(u.shadowParams);
  let depth = rawReceiverDepth - bias;
  
  var shadow: f32 = 0.0;
  
  for (var i = 0; i < 16; i = i + 1) {
    let offset = POISSON_64[i] * filterRadius * texelSize;
    shadow += compareShadow(lightIndex, uv + offset, depth);
  }
  
  return shadow / 16.0;
}


fn penumbraSize(zReceiver: f32, zBlocker: f32) -> f32 {
  let lightSize = shadowParamY(u.shadowParams);
  return max((zReceiver - zBlocker) * lightSize / max(zBlocker, 0.001), 0.0);
}

fn samplePCSS(lightSpacePos: vec4<f32>, light: Light, lightIndex: i32, bias: f32) -> f32 {
  let sample = makeUnbiasedShadowSample(lightSpacePos);
  let rawReceiverDepth = sample.depth;
  let zReceiver = pcssDepthForLight(light, rawReceiverDepth);
  
  // ВСЕГДА выполняем поиск блокеров (uniform control flow)
  let searchWidth = clamp(shadowParamY(u.shadowParams) * mix(45.0, 130.0, zReceiver), 3.0, 32.0);
  let blockerInfo = findBlockerDistance(sample.uv, zReceiver, searchWidth, light, lightIndex);
  
  // Проверяем наличие блокеров
  let hasBlockers = blockerInfo.x >= 0.0;
  
  // Если есть блокеры, вычисляем радиус полутени, иначе 0
  let penumbra = select(0.0, penumbraSize(zReceiver, blockerInfo.x), hasBlockers);
  let filterRadius = clamp(1.0 + penumbra * 150.0, 1.0, 28.0);
  
  // ВСЕГДА выполняем PCF (uniform control flow)
  let pcfResult = pcfFilter(sample.uv, rawReceiverDepth, filterRadius, lightIndex, bias);
  
  // Если нет блокеров → 1.0 (полностью освещено)
  // Если есть блокеры → результат PCF
  let shadowResult = select(pcfResult, 1.0, !hasBlockers);
  
  // Если вне границ → 1.0, иначе результат теней
  return select(shadowResult, 1.0, !sample.inBounds);
}

fn computeLightContribution(
  N: vec3<f32>,
  worldPos: vec3<f32>,
  light: Light,
  isShadowed: bool,
  lightIndex: i32
) -> LightContribution {
  let L = computeLightDirection(light, worldPos);
  let attenuation = computeSpotFactor(light, worldPos) * computeDistanceFalloff(light, worldPos);
  let lambert = max(dot(N, L), 0.0) * attenuation;

  var vis: f32 = 1.0;
  if (isShadowed && lightIndex >= 0) {
    let lsMat = shadowMats.mats[lightIndex];
    let bias = shadowBiasForLight(light, u.shadowParams);
    let biasedWorldPos = worldPos + N * receiverNormalBiasForLight(light, N, L, u.shadowParams);
    let lightSpacePos = lsMat * vec4<f32>(biasedWorldPos, 1.0);
    let rawVisibility = samplePCSS(lightSpacePos, light, lightIndex, bias);
    vis = mixShadowStrength(rawVisibility, shading.shadowStrength);
  }

  let viewDir = normalize(u.cameraPos.xyz - worldPos);
  let roughness = clamp(objParams.spec.w, 0.02, 1.0);
  let shininess = mix(128.0, 4.0, roughness);
  let specular = blinnPhongSpecular(N, L, viewDir, shininess) * attenuation;
  let intensity = max(light.intensity, 0.0);
  let specFactor = max(objParams.spec.x, 0.0);

  return LightContribution(
    light.color * (lambert * vis * intensity),
    light.color * (specular * vis * intensity * specFactor),
    vis
  );
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let _shadowCount = shadowMats.count;
  let N = normalize(input.worldN);
  let worldPos = input.worldPos;

  var baseColor = objParams.base.xyz;
  let texColor = textureSample(objTex, objSampler, input.uv).xyz;
  baseColor = baseColor * texColor;

  let ambient = computeHemisphereAmbient(N, shading);
  let lightCount = i32(round(lightsData.count));
  var diffuseSum: vec3<f32> = vec3<f32>(0.0);
  var specularSum: vec3<f32> = vec3<f32>(0.0);
  var visibilitySum: f32 = 0.0;
  var activeCone: f32 = 0.0;
  var activeFalloff: f32 = 0.0;
  var activeVisibility: f32 = 1.0;
  let receive = objParams.base.w;
  let activeLightIndex = i32(round(shading.activeLightIndex));

  for (var i = 0; i < lightCount; i = i + 1) {
    let light = lightsData.lights[i];
    let lightIndex = i32(round(light.shadowIndex));
    let isShadowed = receive > 0.5 && lightIndex >= 0;

    let contrib = computeLightContribution(N, worldPos, light, isShadowed, lightIndex);
    diffuseSum = diffuseSum + contrib.diffuse;
    specularSum = specularSum + contrib.specular;
    visibilitySum = visibilitySum + contrib.visibility;
    if (i == activeLightIndex) {
      activeCone = computeSpotFactor(light, worldPos);
      activeFalloff = computeDistanceFalloff(light, worldPos);
      activeVisibility = contrib.visibility;
    }
  }

  let diffuse = diffuseSum;
  let exposure = max(shading.exposure, 0.0);
  let debugMode = lightDebugModeIndex(shading);
  let lightCountF = max(f32(lightCount), 1.0);

  if (debugMode == LIGHT_DEBUG_LIGHTING) {
    return vec4<f32>(toneMap((ambient + diffuse) * exposure), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_DIFFUSE) {
    return vec4<f32>(toneMap(diffuseSum * exposure), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_SPECULAR) {
    return vec4<f32>(toneMap(specularSum * exposure), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_SHADOW) {
    let shadowMask = clamp(visibilitySum / lightCountF, 0.0, 1.0);
    return vec4<f32>(vec3<f32>(shadowMask), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_NORMALS) {
    return vec4<f32>(N * 0.5 + vec3<f32>(0.5), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_ACTIVE_CONE) {
    return vec4<f32>(vec3<f32>(activeCone), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_ACTIVE_FALLOFF) {
    return vec4<f32>(vec3<f32>(activeFalloff), 1.0);
  }
  if (debugMode == LIGHT_DEBUG_ACTIVE_SHADOW) {
    return vec4<f32>(vec3<f32>(activeVisibility), 1.0);
  }

  let finalColor = toneMap((baseColor * (ambient + diffuse) + specularSum * 0.45) * exposure);
  return vec4<f32>(finalColor, 1.0);
}
