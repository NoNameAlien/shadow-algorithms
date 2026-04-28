import { SphereGenerator } from '../geometry/SphereGenerator';

export type MeshGeometry = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

export type LineGeometry = {
  vertices: Float32Array;
  indices: Uint16Array;
};

export function createCubeGeometry(): MeshGeometry {
  return {
    positions: new Float32Array([
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
      -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1,
      1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1,
      -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1,
      -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,
      -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1
    ]),
    normals: new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0
    ]),
    uvs: new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 0, 1, 1, 1, 1, 0,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 0, 1, 1, 1, 1, 0
    ]),
    indices: new Uint16Array([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ])
  };
}

export function createGridGeometry(): Omit<MeshGeometry, 'indices'> {
  return {
    positions: new Float32Array([
      -10, -2.5, -10, 10, -2.5, -10, 10, -2.5, 10,
      -10, -2.5, -10, 10, -2.5, 10, -10, -2.5, 10
    ]),
    normals: new Float32Array([
      0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0
    ]),
    uvs: new Float32Array([
      0, 0, 5, 0, 5, 5,
      0, 0, 5, 5, 0, 5
    ])
  };
}

export function createWallsGeometry(): Omit<MeshGeometry, 'indices'> {
  const yBottom = -2.5;
  const yTop = 7.5;
  const xMin = -10;
  const xMax = 10;
  const zMin = -10;
  const zMax = 10;

  const backPos = [
    xMin, yBottom, zMin,
    xMax, yBottom, zMin,
    xMax, yTop, zMin,
    xMin, yBottom, zMin,
    xMax, yTop, zMin,
    xMin, yTop, zMin
  ];
  const backNorm = [
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1
  ];
  const backUV = [
    0, 0, 5, 0, 5, 5,
    0, 0, 5, 5, 0, 5
  ];

  const rightPos = [
    xMax, yBottom, zMin,
    xMax, yBottom, zMax,
    xMax, yTop, zMax,
    xMax, yBottom, zMin,
    xMax, yTop, zMax,
    xMax, yTop, zMin
  ];
  const rightNorm = [
    -1, 0, 0, -1, 0, 0, -1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0
  ];
  const rightUV = [
    0, 0, 5, 0, 5, 5,
    0, 0, 5, 5, 0, 5
  ];

  return {
    positions: new Float32Array([...backPos, ...rightPos]),
    normals: new Float32Array([...backNorm, ...rightNorm]),
    uvs: new Float32Array([...backUV, ...rightUV])
  };
}

function createConeGeometry({
  segments,
  radius,
  height,
  tipDown,
  includeBase
}: {
  segments: number;
  radius: number;
  height: number;
  tipDown: boolean;
  includeBase: boolean;
}): { vertices: Float32Array; indices: Uint16Array } {
  const vertices: number[] = [];
  const indices: number[] = [];
  const tipY = tipDown ? -height * 0.5 : height * 0.5;
  const baseY = tipDown ? height * 0.5 : -height * 0.5;

  vertices.push(0, tipY, 0);

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
  }

  for (let i = 0; i < segments; i++) {
    indices.push(0, 1 + i, 1 + ((i + 1) % segments));
  }

  if (includeBase) {
    const baseCenterIndex = 1 + segments;
    vertices.push(0, baseY, 0);
    for (let i = 0; i < segments; i++) {
      const i1 = 1 + i;
      const i2 = 1 + ((i + 1) % segments);
      indices.push(baseCenterIndex, i2, i1);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices)
  };
}

export function createLightMeshesGeometry() {
  const sun = SphereGenerator.createIcosphere(0.4, 1);
  const spot = createConeGeometry({ segments: 16, radius: 0.5, height: 1.0, tipDown: false, includeBase: false });
  const top = createConeGeometry({ segments: 16, radius: 0.5, height: 1.0, tipDown: true, includeBase: true });
  const beam = {
    vertices: new Float32Array(2 * 3),
    indices: new Uint16Array([0, 1])
  };

  return { sun, spot, top, beam };
}

export function createAxisGizmoGeometry(): LineGeometry {
  const size = 2.2;
  const vertices: number[] = [];
  const indices: number[] = [];
  let base = 0;

  const pushLine = (
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    r: number, g: number, b: number
  ) => {
    vertices.push(x1, y1, z1, r, g, b, x2, y2, z2, r, g, b);
    indices.push(base, base + 1);
    base += 2;
  };

  pushLine(0, 0, 0, size, 0, 0, 1, 0, 0);
  pushLine(0, 0, 0, 0, size, 0, 0, 1, 0);
  pushLine(0, 0, 0, 0, -size, 0, 0, 1, 0);
  pushLine(0, 0, 0, 0, 0, size, 0, 0, 1);

  const circleRadius = size * 0.9;
  const circleSegments = 32;

  for (let i = 0; i < circleSegments; i++) {
    const a0 = (i / circleSegments) * Math.PI * 2;
    const a1 = ((i + 1) / circleSegments) * Math.PI * 2;
    pushLine(
      Math.cos(a0) * circleRadius,
      0,
      Math.sin(a0) * circleRadius,
      Math.cos(a1) * circleRadius,
      0,
      Math.sin(a1) * circleRadius,
      1,
      1,
      1
    );
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices)
  };
}
