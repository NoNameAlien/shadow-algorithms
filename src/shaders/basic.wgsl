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
  shadowParams: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowSampler: sampler_comparison;

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

fn shadowVisibility(lightSpacePos: vec4<f32>) -> f32 {
  let ndc = lightSpacePos.xyz / lightSpacePos.w;
  let uv = ndc.xy * 0.5 + vec2<f32>(0.5);
  let depth = ndc.z - u.shadowParams.x;
  
  let inBounds = ndc.x >= -1.0 && ndc.x <= 1.0 && 
                 ndc.y >= -1.0 && ndc.y <= 1.0 && 
                 ndc.z >= 0.0 && ndc.z <= 1.0;
  
  let shadow = textureSampleCompare(shadowMap, shadowSampler, uv, depth);
  return select(shadow, 1.0, !inBounds);
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(input.worldN);
  let L = normalize(u.lightDir.xyz);
  let lambert = max(dot(N, L), 0.0);
  
  let visibility = shadowVisibility(input.lightSpacePos);
  
  let baseColor = vec3<f32>(0.6, 0.62, 0.65);
  let ambient = 0.25;
  let diffuse = (1.0 - ambient) * lambert * visibility;
  
  let finalColor = baseColor * min(ambient + diffuse * 0.8, 1.0);
  return vec4<f32>(finalColor, 1.0);
}
