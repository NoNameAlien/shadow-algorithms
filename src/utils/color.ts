export const hexToRgb01 = (hex: string): [number, number, number] => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return [0.2, 0.2, 0.2];

  const intValue = parseInt(match[1], 16);
  const r = ((intValue >> 16) & 255) / 255;
  const g = ((intValue >> 8) & 255) / 255;
  const b = (intValue & 255) / 255;

  return [r, g, b];
};

export const rgb01ToHex = (rgb: [number, number, number]): string => {
  const [r, g, b] = rgb.map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255));
  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
