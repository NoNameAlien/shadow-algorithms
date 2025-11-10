@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba16float, write>; // ИЗМЕНЕНО с rg32float

// Простой 5x5 Gaussian kernel (приближённый)
const KERNEL_SIZE: i32 = 5;
const KERNEL_HALF: i32 = 2;
const WEIGHTS: array<f32, 5> = array<f32, 5>(
  0.06136, 0.24477, 0.38774, 0.24477, 0.06136
);

@compute @workgroup_size(8, 8)
fn cs_horizontal(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  if (id.x >= size.x || id.y >= size.y) {
    return;
  }
  
  var sum = vec2<f32>(0.0);
  for (var i = -KERNEL_HALF; i <= KERNEL_HALF; i = i + 1) {
    let x = i32(id.x) + i;
    let coord = vec2<i32>(clamp(x, 0, i32(size.x) - 1), i32(id.y));
    let sample = textureLoad(inputTex, coord, 0).rg;
    sum += sample * WEIGHTS[i + KERNEL_HALF];
  }
  
  // Записываем в RGBA (RG используем, BA = 0)
  textureStore(outputTex, vec2<i32>(id.xy), vec4<f32>(sum, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn cs_vertical(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(inputTex);
  if (id.x >= size.x || id.y >= size.y) {
    return;
  }
  
  var sum = vec2<f32>(0.0);
  for (var i = -KERNEL_HALF; i <= KERNEL_HALF; i = i + 1) {
    let y = i32(id.y) + i;
    let coord = vec2<i32>(i32(id.x), clamp(y, 0, i32(size.y) - 1));
    let sample = textureLoad(inputTex, coord, 0).rg;
    sum += sample * WEIGHTS[i + KERNEL_HALF];
  }
  
  // Записываем в RGBA (RG используем, BA = 0)
  textureStore(outputTex, vec2<i32>(id.xy), vec4<f32>(sum, 0.0, 0.0));
}
