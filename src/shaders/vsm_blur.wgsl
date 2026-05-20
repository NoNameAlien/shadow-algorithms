@group(0) @binding(0) var inputTex: texture_2d_array<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d_array<rgba16float, write>;

struct BlurParams {
  radius: f32,
  sigma: f32,
  _pad0: vec2<f32>,
};

@group(0) @binding(2) var<uniform> blurParams: BlurParams;

const MAX_RADIUS: i32 = 8;

fn gaussianWeight(offset: i32) -> f32 {
  let x = f32(offset);
  let sigma = max(blurParams.sigma, 0.001);
  return exp(-0.5 * (x * x) / (sigma * sigma));
}

@compute @workgroup_size(8, 8)
fn cs_horizontal(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  if (id.x >= size.x || id.y >= size.y || id.z >= textureNumLayers(inputTex)) {
    return;
  }
  
  var sum = vec2<f32>(0.0);
  var weightSum = 0.0;
  let radius = clamp(i32(round(blurParams.radius)), 1, MAX_RADIUS);

  for (var i = -MAX_RADIUS; i <= MAX_RADIUS; i = i + 1) {
    if (abs(i) > radius) {
      continue;
    }

    let x = i32(id.x) + i;
    let coord = vec2<i32>(clamp(x, 0, i32(size.x) - 1), i32(id.y));
    let sample = textureLoad(inputTex, coord, i32(id.z), 0).rg;
    let weight = gaussianWeight(i);
    sum += sample * weight;
    weightSum += weight;
  }
  
  // Записываем в RGBA (RG используем, BA = 0)
  textureStore(outputTex, vec2<i32>(id.xy), i32(id.z), vec4<f32>(sum / max(weightSum, 0.000001), 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn cs_vertical(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  if (id.x >= size.x || id.y >= size.y || id.z >= textureNumLayers(inputTex)) {
    return;
  }
  
  var sum = vec2<f32>(0.0);
  var weightSum = 0.0;
  let radius = clamp(i32(round(blurParams.radius)), 1, MAX_RADIUS);

  for (var i = -MAX_RADIUS; i <= MAX_RADIUS; i = i + 1) {
    if (abs(i) > radius) {
      continue;
    }

    let y = i32(id.y) + i;
    let coord = vec2<i32>(i32(id.x), clamp(y, 0, i32(size.y) - 1));
    let sample = textureLoad(inputTex, coord, i32(id.z), 0).rg;
    let weight = gaussianWeight(i);
    sum += sample * weight;
    weightSum += weight;
  }
  
  // Записываем в RGBA (RG используем, BA = 0)
  textureStore(outputTex, vec2<i32>(id.xy), i32(id.z), vec4<f32>(sum / max(weightSum, 0.000001), 0.0, 0.0));
}
