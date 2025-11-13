export type GeometryData = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
};

export class SphereGenerator {
  // Icosphere - равномерное распределение вершин
  static createIcosphere(radius: number = 1.0, subdivisions: number = 1): GeometryData {
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;

    // 12 вершин икосаэдра
    let positions = [
      -1, t, 0,   1, t, 0,   -1, -t, 0,   1, -t, 0,
      0, -1, t,   0, 1, t,   0, -1, -t,   0, 1, -t,
      t, 0, -1,   t, 0, 1,   -t, 0, -1,   -t, 0, 1
    ];

    // 20 граней икосаэдра
    let indices = [
      0, 11, 5,  0, 5, 1,   0, 1, 7,   0, 7, 10,  0, 10, 11,
      1, 5, 9,   5, 11, 4,  11, 10, 2, 10, 7, 6,  7, 1, 8,
      3, 9, 4,   3, 4, 2,   3, 2, 6,   3, 6, 8,   3, 8, 9,
      4, 9, 5,   2, 4, 11,  6, 2, 10,  8, 6, 7,   9, 8, 1
    ];

    // Subdivision для гладкости
    for (let i = 0; i < subdivisions; i++) {
      const newIndices: number[] = [];
      const midpointCache = new Map<string, number>();

      const getMidpoint = (i1: number, i2: number): number => {
        const key = `${Math.min(i1, i2)}_${Math.max(i1, i2)}`;
        if (midpointCache.has(key)) return midpointCache.get(key)!;

        const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];
        const x2 = positions[i2 * 3], y2 = positions[i2 * 3 + 1], z2 = positions[i2 * 3 + 2];

        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, mz = (z1 + z2) / 2;
        const len = Math.sqrt(mx * mx + my * my + mz * mz);

        const newIndex = positions.length / 3;
        positions.push(mx / len, my / len, mz / len);
        midpointCache.set(key, newIndex);
        return newIndex;
      };

      for (let j = 0; j < indices.length; j += 3) {
        const v1 = indices[j], v2 = indices[j + 1], v3 = indices[j + 2];
        const a = getMidpoint(v1, v2), b = getMidpoint(v2, v3), c = getMidpoint(v3, v1);

        newIndices.push(v1, a, c, v2, b, a, v3, c, b, a, b, c);
      }

      indices = newIndices;
    }

    // Нормализация и масштабирование
    const finalPositions = new Float32Array(positions.length);
    const finalNormals = new Float32Array(positions.length);

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      const len = Math.sqrt(x * x + y * y + z * z);

      finalPositions[i] = (x / len) * radius;
      finalPositions[i + 1] = (y / len) * radius;
      finalPositions[i + 2] = (z / len) * radius;

      finalNormals[i] = x / len;
      finalNormals[i + 1] = y / len;
      finalNormals[i + 2] = z / len;
    }

    return {
      positions: finalPositions,
      normals: finalNormals,
      indices: new Uint16Array(indices)
    };
  }
}
