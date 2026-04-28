// @include object_common

@group(1) @binding(0) var shadowMap0: texture_depth_2d;
@group(1) @binding(1) var shadowSampler0: sampler_comparison;
@group(1) @binding(2) var shadowMap1: texture_depth_2d;
@group(1) @binding(3) var shadowSampler1: sampler_comparison;

fn shadowVisibilityIndexed(lightSpacePos: vec4<f32>, lightIndex: i32) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
  let depth = ndc.z - u.shadowParams.x;

  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 &&
                 ndc.y >= -1.0 && ndc.y <= 1.0 &&
                 ndc.z >= 0.0 && ndc.z <= 1.0;

  if (lightIndex == 0) {
    let shadow = textureSampleCompare(shadowMap0, shadowSampler0, uv, depth);
    return select(shadow, 1.0, !inBounds);
  } else {
    let shadow = textureSampleCompare(shadowMap1, shadowSampler1, uv, depth);
    return select(shadow, 1.0, !inBounds);
  }
}

fn computeLightContribution(
  N: vec3<f32>,
  worldPos: vec3<f32>,
  light: Light,
  isShadowed: bool,
  lightIndex: i32
) -> f32 {
  let lightPos = light.pos;
  let mode = i32(round(light.lightType));

  var L: vec3<f32>;
  var lambert: f32;

  if (mode == LIGHT_MODE_TOP) {
    L = normalize(vec3<f32>(0.0, 1.0, 0.0));
    lambert = max(dot(N, L), 0.0);
  } else if (mode == LIGHT_MODE_SPOT) {
    let yaw = light.yaw;
    let pitch = light.pitch;
    let axis = vec3<f32>(
      cos(pitch) * sin(yaw),
      sin(pitch),
      cos(pitch) * cos(yaw)
    );

    let toFrag = normalize(worldPos - lightPos);
    L = normalize(lightPos - worldPos);
    lambert = max(dot(N, L), 0.0);

    let cosAngle = dot(toFrag, axis);
    let innerDeg: f32 = 15.0;
    let outerDeg: f32 = 25.0;
    let inner = cos(innerDeg * PI / 180.0);
    let outer = cos(outerDeg * PI / 180.0);
    let tSpot = clamp((cosAngle - outer) / (inner - outer), 0.0, 1.0);
    lambert = lambert * tSpot;
  } else {
    L = normalize(lightPos);
    lambert = max(dot(N, L), 0.0);
  }

  var vis: f32 = 1.0;
  if (isShadowed && lightIndex >= 0) {
    let lsMat = shadowMats.mats[lightIndex];
    let lightSpacePos = lsMat * vec4<f32>(worldPos, 1.0);
    let rawVisibility = shadowVisibilityIndexed(lightSpacePos, lightIndex);

    let strength = clamp(shading.shadowStrength, 0.0, 2.0);
    let t = clamp(strength, 0.0, 1.0);
    vis = mix(1.0, rawVisibility, t);

    if (strength > 1.0) {
      let extra = strength - 1.0;
      vis = max(0.0, vis * (1.0 - extra));
    }
  }

  let viewDir = normalize(u.cameraPos.xyz - worldPos);
  let halfVec = normalize(L + viewDir);
  let specAngle = max(dot(N, halfVec), 0.0);
  let shininess = max(objParams.spec.y, 1.0);
  let specular = pow(specAngle, shininess);

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
