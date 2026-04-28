const PI: f32 = 3.14159265;
const LIGHT_MODE_SUN: i32 = 0;
const LIGHT_MODE_SPOT: i32 = 1;
const LIGHT_MODE_TOP: i32 = 2;
const SHADOW_METHOD_SM: i32 = 0;
const SHADOW_METHOD_PCF: i32 = 1;
const SHADOW_METHOD_PCSS: i32 = 2;
const SHADOW_METHOD_VSM: i32 = 3;

struct ShadingParams {
  shadowStrength: f32,
  lightMode: f32,
  spotYaw: f32,
  spotPitch: f32,
  methodIndex: f32,
  lightIntensity: f32,
  shadowCaster0: f32,
  shadowCaster1: f32,
};

struct Light {
  pos: vec3<f32>,
  lightType: f32, // 0 = sun, 1 = spot, 2 = top
  yaw: f32,
  pitch: f32,
  intensity: f32,
  color: vec3<f32>,
};

struct LightsData {
  count: f32,
  _pad0: vec3<f32>,
  lights: array<Light, 4>,
};

struct ShadowSample {
  uv: vec2<f32>,
  depth: f32,
  inBounds: bool,
};

fn shadowMethodIndex(shadingParams: ShadingParams) -> i32 {
  return i32(round(shadingParams.methodIndex));
}

fn shadowBias(shadowParams: vec4<f32>) -> f32 {
  return shadowParams.x;
}

fn shadowParamY(shadowParams: vec4<f32>) -> f32 {
  return shadowParams.y;
}

fn shadowParamZ(shadowParams: vec4<f32>) -> f32 {
  return shadowParams.z;
}

fn shadowMapSize(shadowParams: vec4<f32>) -> f32 {
  return max(shadowParams.w, 1.0);
}

fn shadowTexelSize(shadowParams: vec4<f32>) -> f32 {
  return 1.0 / shadowMapSize(shadowParams);
}

fn ndcToUv(ndc: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
}

fn isInBounds(ndc: vec3<f32>) -> bool {
  return ndc.x >= -1.0 && ndc.x <= 1.0 &&
         ndc.y >= -1.0 && ndc.y <= 1.0 &&
         ndc.z >= 0.0 && ndc.z <= 1.0;
}

fn makeShadowSample(lightSpacePos: vec4<f32>, bias: f32) -> ShadowSample {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;

  return ShadowSample(
    ndcToUv(ndc),
    ndc.z - bias,
    isInBounds(ndc)
  );
}

fn makeUnbiasedShadowSample(lightSpacePos: vec4<f32>) -> ShadowSample {
  return makeShadowSample(lightSpacePos, 0.0);
}

fn computeLightDirection(light: Light, worldPos: vec3<f32>) -> vec3<f32> {
  let mode = i32(round(light.lightType));

  if (mode == LIGHT_MODE_TOP) {
    return normalize(vec3<f32>(0.0, 1.0, 0.0));
  }

  if (mode == LIGHT_MODE_SPOT) {
    return normalize(light.pos - worldPos);
  }

  return normalize(light.pos);
}

fn computeSpotFactor(light: Light, worldPos: vec3<f32>) -> f32 {
  let mode = i32(round(light.lightType));
  if (mode != LIGHT_MODE_SPOT) {
    return 1.0;
  }

  let axis = vec3<f32>(
    cos(light.pitch) * sin(light.yaw),
    sin(light.pitch),
    cos(light.pitch) * cos(light.yaw)
  );

  let toFrag = normalize(worldPos - light.pos);
  let cosAngle = dot(toFrag, axis);
  let innerDeg: f32 = 15.0;
  let outerDeg: f32 = 25.0;
  let inner = cos(innerDeg * PI / 180.0);
  let outer = cos(outerDeg * PI / 180.0);

  return clamp((cosAngle - outer) / (inner - outer), 0.0, 1.0);
}

fn blinnPhongSpecular(
  N: vec3<f32>,
  L: vec3<f32>,
  viewDir: vec3<f32>,
  shininess: f32
) -> f32 {
  let halfVec = normalize(L + viewDir);
  let specAngle = max(dot(N, halfVec), 0.0);
  return pow(specAngle, max(shininess, 1.0));
}

fn mixShadowStrength(rawVisibility: f32, shadowStrength: f32) -> f32 {
  let strength = clamp(shadowStrength, 0.0, 2.0);
  let t = clamp(strength, 0.0, 1.0);
  var visibility = mix(1.0, rawVisibility, t);

  if (strength > 1.0) {
    let extra = strength - 1.0;
    visibility = max(0.0, visibility * (1.0 - extra));
  }

  return visibility;
}
