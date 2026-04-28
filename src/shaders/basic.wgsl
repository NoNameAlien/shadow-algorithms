// @include object_common

@group(1) @binding(0) var shadowMap0: texture_depth_2d;
@group(1) @binding(1) var shadowSampler0: sampler_comparison;
@group(1) @binding(2) var shadowMap1: texture_depth_2d;
@group(1) @binding(3) var shadowSampler1: sampler_comparison;

fn shadowVisibilityIndexed(lightSpacePos: vec4<f32>, lightIndex: i32) -> f32 {
  let sample = makeShadowSample(lightSpacePos, shadowBias(u.shadowParams));

  if (lightIndex == 0) {
    let shadow = textureSampleCompare(shadowMap0, shadowSampler0, sample.uv, sample.depth);
    return select(shadow, 1.0, !sample.inBounds);
  } else {
    let shadow = textureSampleCompare(shadowMap1, shadowSampler1, sample.uv, sample.depth);
    return select(shadow, 1.0, !sample.inBounds);
  }
}

fn computeLightContribution(
  N: vec3<f32>,
  worldPos: vec3<f32>,
  light: Light,
  isShadowed: bool,
  lightIndex: i32
) -> f32 {
  let L = computeLightDirection(light, worldPos);
  let lambert = max(dot(N, L), 0.0) * computeSpotFactor(light, worldPos);

  var vis: f32 = 1.0;
  if (isShadowed && lightIndex >= 0) {
    let lsMat = shadowMats.mats[lightIndex];
    let lightSpacePos = lsMat * vec4<f32>(worldPos, 1.0);
    let rawVisibility = shadowVisibilityIndexed(lightSpacePos, lightIndex);
    vis = mixShadowStrength(rawVisibility, shading.shadowStrength);
  }

  let viewDir = normalize(u.cameraPos.xyz - worldPos);
  let specular = blinnPhongSpecular(N, L, viewDir, objParams.spec.y);
  let intensity = max(light.intensity, 0.0);
  let diffuseTerm = lambert * vis * intensity;
  let specFactor = max(objParams.spec.x, 0.0);
  let specTerm = specular * vis * intensity * specFactor;

  return diffuseTerm + specTerm;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let _shadowCount = shadowMats.count;
  let N = normalize(input.worldN);
  let worldPos = input.worldPos;

  var baseColor = objParams.base.xyz;
  let texColor = textureSample(objTex, objSampler, input.uv).xyz;
  baseColor = baseColor * texColor;

  let ambient = 0.55;
  let lightCount = i32(round(lightsData.count));
  var diffuseSum: vec3<f32> = vec3<f32>(0.0);
  let caster0 = i32(round(shading.shadowCaster0));
  let caster1 = i32(round(shading.shadowCaster1));
  let receive = objParams.base.w;

  for (var i = 0; i < lightCount; i = i + 1) {
    let light = lightsData.lights[i];

    var isShadowed = false;
    var lightIndex = -1;

    if (receive > 0.5) {
      if (i == caster0) {
        isShadowed = true;
        lightIndex = 0;
      } else if (i == caster1) {
        isShadowed = true;
        lightIndex = 1;
      }
    }

    let contrib = computeLightContribution(N, worldPos, light, isShadowed, lightIndex);
    diffuseSum = diffuseSum + contrib * light.color;
  }

  let diffuse = (1.0 - ambient) * diffuseSum;
  let lighting = clamp(ambient + diffuse, vec3<f32>(0.0), vec3<f32>(1.0));
  let finalColor = baseColor * lighting;
  return vec4<f32>(finalColor, 1.0);
}
