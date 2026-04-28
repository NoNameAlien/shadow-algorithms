fn computeLightContribution(
  N: vec3<f32>,
  worldPos: vec3<f32>,
  light: Light,
  isShadowed: bool,
  lightSpacePos: vec4<f32>
) -> f32 {
  let L = computeLightDirection(light, worldPos);
  let lambert = max(dot(N, L), 0.0) * computeSpotFactor(light, worldPos);

  var vis: f32 = 1.0;
  if (isShadowed) {
    let rawVisibility = shadowVisibility(lightSpacePos);
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

  let ambient = 0.55;

  let lightCount = i32(round(lightsData.count));
  var diffuseSum: vec3<f32> = vec3<f32>(0.0);
  let caster = i32(round(shading.shadowCaster0));
  let receive = objParams.base.w;

  for (var i = 0; i < lightCount; i = i + 1) {
    let light = lightsData.lights[i];
    let isShadowed = (i == caster) && (receive > 0.5);

    let contrib = computeLightContribution(
      N,
      worldPos,
      light,
      isShadowed,
      input.lightSpacePos
    );
    diffuseSum = diffuseSum + contrib * light.color;
  }

  let diffuse = (1.0 - ambient) * diffuseSum;
  let lighting = clamp(ambient + diffuse, vec3<f32>(0.0), vec3<f32>(1.0));
  let finalColor = baseColor * lighting;
  return vec4<f32>(finalColor, 1.0);
}
