export type TextureWithView = {
  texture: GPUTexture;
  view: GPUTextureView;
};

export async function createTextureFromImageFile(device: GPUDevice, file: File): Promise<TextureWithView> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);

  const width = img.width;
  const height = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось создать 2D контекст для загрузки текстуры');
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const src = imageData.data;
  const bytesPerPixel = 4;
  const unpaddedRowSize = width * bytesPerPixel;
  const paddedRowSize = Math.ceil(unpaddedRowSize / 256) * 256;
  const dst = new Uint8Array(paddedRowSize * height);

  for (let y = 0; y < height; y++) {
    const srcOffset = y * unpaddedRowSize;
    const dstOffset = y * paddedRowSize;
    dst.set(src.subarray(srcOffset, srcOffset + unpaddedRowSize), dstOffset);
  }

  const texture = device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
  });

  device.queue.writeTexture({ texture }, dst, { bytesPerRow: paddedRowSize }, { width, height });

  return { texture, view: texture.createView() };
}

export function createSolidTexture(device: GPUDevice, r: number, g: number, b: number): TextureWithView {
  const texture = device.createTexture({
    size: [1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
  });

  device.queue.writeTexture(
    { texture },
    new Uint8Array([r, g, b, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1 }
  );

  return { texture, view: texture.createView() };
}
