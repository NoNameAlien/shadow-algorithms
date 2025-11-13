struct VSIn {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldN: vec3<f32>,
  @location(2) lightSpacePos: vec4<f32>,
};

struct Uniforms {
  model: mat4x4<f32>,
  viewProj: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  lightDir: vec4<f32>,
  shadowParams: vec4<f32>, // x: bias, y: radius, z: sampleCount, w: shadowMapSize
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

// Poisson disk - используем максимум 64 сэмпла (можно меньше через uniform)
const POISSON_64: array<vec2<f32>, 64> = array<vec2<f32>, 64>(
  vec2<f32>(-0.613, 0.354), vec2<f32>(0.743, -0.125), vec2<f32>(-0.212, -0.532), vec2<f32>(0.124, 0.987),
  vec2<f32>(-0.945, -0.123), vec2<f32>(0.432, 0.456), vec2<f32>(-0.321, 0.765), vec2<f32>(0.876, 0.321),
  vec2<f32>(-0.111, -0.987), vec2<f32>(0.234, -0.654), vec2<f32>(-0.765, 0.111), vec2<f32>(0.567, -0.876),
  vec2<f32>(-0.456, -0.234), vec2<f32>(0.789, 0.654), vec2<f32>(-0.888, 0.444), vec2<f32>(0.111, -0.111),
  vec2<f32>(0.345, 0.234), vec2<f32>(-0.567, 0.678), vec2<f32>(0.234, -0.345), vec2<f32>(-0.123, 0.567),
  vec2<f32>(0.678, -0.234), vec2<f32>(-0.345, -0.567), vec2<f32>(0.456, 0.123), vec2<f32>(-0.678, 0.345),
  vec2<f32>(0.567, 0.678), vec2<f32>(-0.234, 0.456), vec2<f32>(0.345, -0.123), vec2<f32>(-0.456, 0.234),
  vec2<f32>(0.123, -0.678), vec2<f32>(-0.567, 0.345), vec2<f32>(0.678, 0.456), vec2<f32>(-0.345, -0.678),
  vec2<f32>(0.234, 0.345), vec2<f32>(-0.123, -0.456), vec2<f32>(0.567, -0.234), vec2<f32>(-0.678, 0.123),
  vec2<f32>(0.456, -0.567), vec2<f32>(-0.234, 0.678), vec2<f32>(0.345, -0.678), vec2<f32>(-0.456, 0.234),
  vec2<f32>(0.123, 0.567), vec2<f32>(-0.345, -0.123), vec2<f32>(0.678, 0.234), vec2<f32>(-0.567, -0.345),
  vec2<f32>(0.456, 0.678), vec2<f32>(-0.234, -0.567), vec2<f32>(0.345, 0.123), vec2<f32>(-0.678, -0.456),
  vec2<f32>(-0.789, 0.234), vec2<f32>(0.567, -0.345), vec2<f32>(-0.123, 0.789), vec2<f32>(0.345, -0.567),
  vec2<f32>(-0.234, -0.789), vec2<f32>(0.123, 0.456), vec2<f32>(-0.567, 0.345), vec2<f32>(0.789, -0.123),
  vec2<f32>(-0.345, 0.567), vec2<f32>(0.234, -0.678), vec2<f32>(-0.456, 0.789), vec2<f32>(0.567, -0.234),
  vec2<f32>(-0.678, -0.345), vec2<f32>(0.456, 0.123), vec2<f32>(-0.789, 0.678), vec2<f32>(0.234, -0.456)
);

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let world = u.model * vec4<f32>(input.position, 1.0);
  out.clipPos = u.viewProj * world;
  let nWorld = (u.model * vec4<f32>(input.normal, 0.0)).xyz;
  out.worldN = normalize(nWorld);
  out.worldPos = world.xyz;
  out.lightSpacePos = u.lightViewProj * world;
  return out;
}

fn shadowVisibilityPCF(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
  let depth = ndc.z - u.shadowParams.x;
  
  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 && 
                 ndc.y >= -1.0 && ndc.y <= 1.0 && 
                 ndc.z >= 0.0 && ndc.z <= 1.0;
  
  let texelSize = 1.0 / u.shadowParams.w;
  let radius = u.shadowParams.y;
  let sampleCount = i32(u.shadowParams.z);
  
  var shadow: f32 = 0.0;
  
  // Оптимизация: используем только нужное количество сэмплов
  let maxSamples = min(sampleCount, 32); // Разрешаем до 32
  
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


@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(input.worldN);
  let L = normalize(u.lightDir.xyz);
  let lambert = max(dot(N, L), 0.0);
  
  let visibility = shadowVisibilityPCF(input.lightSpacePos); // зависит от метода
  
  let baseColor = vec3<f32>(0.55, 0.57, 0.6); // Уменьшен для меньшей яркости
  let ambient = 0.55; // Увеличен с 0.15 до 0.4 для видимости затененных областей
  let diffuse = (1.0 - ambient) * lambert * visibility;
  let finalColor = baseColor * clamp(ambient + diffuse, 0.0, 1.0);
  return vec4<f32>(finalColor, 1.0);
}

