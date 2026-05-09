// @include object_common

@group(1) @binding(0) var shadowMap: texture_depth_2d_array;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

// @include poisson64

fn samplePCF(lightSpacePos: vec4<f32>, lightIndex: i32, bias: f32) -> f32 {
  let sample = makeShadowSample(lightSpacePos, bias);
  
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
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, lightIndex, sample.depth);
    }
    shadow /= 4.0;
  } else if (maxSamples <= 8) {
    for (var i = 0; i < 8; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, lightIndex, sample.depth);
    }
    shadow /= 8.0;
  } else if (maxSamples <= 16) {
    for (var i = 0; i < 16; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, lightIndex, sample.depth);
    }
    shadow /= 16.0;
  } else {
    for (var i = 0; i < 32; i = i + 1) {
      let offset = POISSON_64[i] * radius * texelSize;
      shadow += textureSampleCompare(shadowMap, shadowSampler, sample.uv + offset, lightIndex, sample.depth);
    }
    shadow /= 32.0;
  }
  
  return select(shadow, 1.0, !sample.inBounds);
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
    let rawVisibility = samplePCF(lightSpacePos, lightIndex, bias);
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
