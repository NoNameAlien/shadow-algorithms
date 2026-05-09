// @include object_common

@group(1) @binding(0) var momentsTex: texture_2d_array<f32>;
@group(1) @binding(1) var momentsSampler: sampler;

fn chebyshevUpperBound(moments: vec2<f32>, t: f32) -> f32 {
  let mean = moments.x;
  let meanSquare = moments.y;
  
  // Если приёмник ближе средней глубины — полностью освещён
  if (t <= mean) {
    return 1.0;
  }
  
  // Variance = E[X²] - E[X]²
  let minVariance = shadowBias(u.shadowParams);
  var variance = max(meanSquare - mean * mean, minVariance);
  
  // Chebyshev: P(X >= t) <= σ² / (σ² + (t - μ)²)
  let d = t - mean;
  var pMax = variance / (variance + d * d);
  
  // Light bleeding reduction: линейное сжатие
  let bleedReduction = shadowParamY(u.shadowParams);
  pMax = clamp((pMax - bleedReduction) / (1.0 - bleedReduction), 0.0, 1.0);
  
  return pMax;
}

fn linearizePerspectiveDepth(depth: f32, near: f32, far: f32) -> f32 {
  let distance = (near * far) / max(far - depth * (far - near), 0.000001);
  return clamp((distance - near) / max(far - near, 0.000001), 0.0, 1.0);
}

fn vsmDepthForLight(light: Light, rawDepth: f32) -> f32 {
  let mode = i32(round(light.lightType));
  if (mode != LIGHT_MODE_SPOT) {
    return rawDepth;
  }

  let near = 0.05;
  let far = max(8.0, max(4.0, light.range) * 1.45);
  return linearizePerspectiveDepth(rawDepth, near, far);
}

fn shadowVisibilityIndexed(lightSpacePos: vec4<f32>, light: Light, lightIndex: i32) -> f32 {
  let sample = makeUnbiasedShadowSample(lightSpacePos);
  let receiverDepth = vsmDepthForLight(light, sample.depth);
  
  // ВСЕГДА читаем моменты (uniform control flow)
  let moments = textureSample(momentsTex, momentsSampler, sample.uv, lightIndex).rg;
  let visibility = chebyshevUpperBound(moments, receiverDepth);
  
  // Возвращаем 1.0 если вне границ, иначе результат VSM
  return select(visibility, 1.0, !sample.inBounds);
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
    let biasedWorldPos = worldPos + N * receiverNormalBias(N, L, u.shadowParams);
    let lightSpacePos = lsMat * vec4<f32>(biasedWorldPos, 1.0);
    let rawVisibility = shadowVisibilityIndexed(lightSpacePos, light, lightIndex);
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

  let exposure = max(shading.exposure, 0.0);
  let debugMode = lightDebugModeIndex(shading);
  let lightCountF = max(f32(lightCount), 1.0);

  if (debugMode == LIGHT_DEBUG_LIGHTING) {
    return vec4<f32>(toneMap((ambient + diffuseSum) * exposure), 1.0);
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

  let finalColor = toneMap((baseColor * (ambient + diffuseSum) + specularSum * 0.45) * exposure);
  return vec4<f32>(finalColor, 1.0);
}
