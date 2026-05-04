struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var debugTexture: texture_2d<f32>;
@group(0) @binding(1) var debugSampler: sampler;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var out: VSOut;
  let position = positions[vertexIndex];
  out.position = vec4<f32>(position, 0.0, 1.0);
  out.uv = vec2<f32>(position.x * 0.5 + 0.5, 1.0 - (position.y * 0.5 + 0.5));
  return out;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let moments = textureSample(debugTexture, debugSampler, input.uv);
  let depth = clamp(moments.r, 0.0, 1.0);
  let variance = max(moments.g - moments.r * moments.r, 0.0);
  let contrast = 1.0 - smoothstep(0.15, 0.95, depth);
  let edge = clamp(length(vec2<f32>(dpdx(depth), dpdy(depth))) * 180.0, 0.0, 1.0);
  let varianceTint = clamp(variance * 28.0, 0.0, 0.45);
  let color = vec3<f32>(
    max(contrast, edge),
    max(contrast + varianceTint, edge),
    max(contrast, edge * 0.65)
  );
  return vec4<f32>(color, 0.94);
}
