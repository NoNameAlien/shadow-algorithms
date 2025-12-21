import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';

export type ModelData = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array | Uint32Array;
};

export class ModelLoader {
  async loadGLTF(url: string): Promise<ModelData> {
    // load() из loaders.gl подтянет JSON и бинарные буферы
    const gltf: any = await load(url, GLTFLoader);

    const json = gltf.json;
    const buffers: ArrayBuffer[] = gltf.buffers || [];

    if (!json?.meshes || json.meshes.length === 0) {
      throw new Error('GLTF не содержит mesh данных');
    }

    // Берём первый primitive первого mesh
    const mesh = json.meshes[0];
    if (!mesh.primitives || mesh.primitives.length === 0) {
      throw new Error('GLTF mesh не содержит primitives');
    }

    const prim = mesh.primitives[0];
    const accessors = json.accessors || [];
    const bufferViews = json.bufferViews || [];

    const posAccessorIndex = prim.attributes?.POSITION;
    const normAccessorIndex = prim.attributes?.NORMAL;
    const idxAccessorIndex = prim.indices;

    if (posAccessorIndex === undefined || normAccessorIndex === undefined) {
      throw new Error('GLTF primitive не содержит POSITION или NORMAL');
    }

    const posAccessor = accessors[posAccessorIndex];
    const normAccessor = accessors[normAccessorIndex];
    const idxAccessor = idxAccessorIndex !== undefined ? accessors[idxAccessorIndex] : null;

    if (!posAccessor || !normAccessor) {
      throw new Error('GLTF mesh не содержит position или normal данных');
    }

    const positions = this.readAccessorAsFloatArray(json, buffers, bufferViews, posAccessor);
    const normals = this.readAccessorAsFloatArray(json, buffers, bufferViews, normAccessor);

    const indicesArray: number[] = idxAccessor
      ? this.readAccessorAsIndexArray(json, buffers, bufferViews, idxAccessor)
      : this.generateIndices(positions.length / 3);

    console.log(
      `✓ Parsed GLTF: ${positions.length / 3} vertices, ${indicesArray.length / 3} triangles`
    );

    return {
      positions,
      normals,
      indices: indicesArray.length < 65536
        ? new Uint16Array(indicesArray)
        : new Uint32Array(indicesArray)
    };
  }

  private readAccessorAsFloatArray(
    _json: any,
    buffers: ArrayBuffer[],
    bufferViews: any[],
    accessor: any
  ): Float32Array {
    const { bufferView: bufferViewIndex, byteOffset = 0, componentType, count, type } = accessor;

    if (bufferViewIndex === undefined) {
      throw new Error('Accessor без bufferView не поддерживается');
    }

    const bufferView = bufferViews[bufferViewIndex];
    const bufferIndex = bufferView.buffer;
    const viewByteOffset = bufferView.byteOffset || 0;
    const byteStride = bufferView.byteStride || 0;

    const buffer = buffers[bufferIndex];
    if (!buffer) {
      throw new Error('GLTF buffer не найден');
    }

    const numComponents =
      type === 'VEC3' ? 3 :
      type === 'VEC2' ? 2 :
      type === 'SCALAR' ? 1 :
      (() => { throw new Error(`Unsupported accessor type: ${type}`); })();

    const componentSize =
      componentType === 5126 /* FLOAT */ ? 4 :
      componentType === 5123 /* UNSIGNED_SHORT */ ? 2 :
      componentType === 5121 /* UNSIGNED_BYTE */ ? 1 :
      (() => { throw new Error(`Unsupported componentType for float array: ${componentType}`); })();

    const result = new Float32Array(count * numComponents);
    const baseOffset = viewByteOffset + byteOffset;
    const stride = byteStride !== 0 ? byteStride : numComponents * componentSize;
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    for (let i = 0; i < count; i++) {
      const srcOffset = baseOffset + i * stride;
      for (let c = 0; c < numComponents; c++) {
        const compOffset = srcOffset + c * componentSize;
        let value: number;
        switch (componentType) {
          case 5126: // FLOAT
            value = dataView.getFloat32(compOffset, true);
            break;
          case 5123: { // UNSIGNED_SHORT
            const v = dataView.getUint16(compOffset, true);
            value = v; // при необходимости можно нормализовать
            break;
          }
          case 5121: { // UNSIGNED_BYTE
            const v = dataView.getUint8(compOffset);
            value = v; // при необходимости можно нормализовать
            break;
          }
          default:
            throw new Error(`Unsupported componentType: ${componentType}`);
        }
        result[i * numComponents + c] = value;
      }
    }

    return result;
  }

  private readAccessorAsIndexArray(
    _json: any,
    buffers: ArrayBuffer[],
    bufferViews: any[],
    accessor: any
  ): number[] {
    const { bufferView: bufferViewIndex, byteOffset = 0, componentType, count, type } = accessor;

    if (bufferViewIndex === undefined) {
      throw new Error('Index accessor без bufferView не поддерживается');
    }
    if (type !== 'SCALAR') {
      throw new Error(`Index accessor type должен быть SCALAR, а не ${type}`);
    }

    const bufferView = bufferViews[bufferViewIndex];
    const bufferIndex = bufferView.buffer;
    const viewByteOffset = bufferView.byteOffset || 0;

    const buffer = buffers[bufferIndex];
    if (!buffer) {
      throw new Error('GLTF buffer не найден (индексы)');
    }

    const baseOffset = viewByteOffset + byteOffset;
    const indices: number[] = [];

    switch (componentType) {
      case 5123: { // UNSIGNED_SHORT
        const src = new Uint16Array(buffer, baseOffset, count);
        for (let i = 0; i < src.length; i++) indices.push(src[i]);
        break;
      }
      case 5125: { // UNSIGNED_INT
        const src = new Uint32Array(buffer, baseOffset, count);
        for (let i = 0; i < src.length; i++) indices.push(src[i]);
        break;
      }
      case 5121: { // UNSIGNED_BYTE
        const src = new Uint8Array(buffer, baseOffset, count);
        for (let i = 0; i < src.length; i++) indices.push(src[i]);
        break;
      }
      default:
        throw new Error(`Unsupported index componentType: ${componentType}`);
    }

    return indices;
  }

  private generateIndices(vertexCount: number): number[] {
    return Array.from({ length: vertexCount }, (_, i) => i);
  }

  async loadOBJ(url: string): Promise<ModelData> {
    const text = await fetch(url).then(r => r.text());
    return this.parseOBJ(text);
  }

  private parseOBJ(text: string): ModelData {
    const objPositions: number[] = [];
    const objNormals: number[] = [];

    const finalPositions: number[] = [];
    const finalNormals: number[] = [];
    const indices: number[] = [];

    const lines = text.split('\n');

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);

      if (parts[0] === 'v') {
        objPositions.push(+parts[1], +parts[2], +parts[3]);
      } else if (parts[0] === 'vn') {
        objNormals.push(+parts[1], +parts[2], +parts[3]);
      }
    }

    const vertexCache = new Map<string, number>(); // "posIdx//normIdx" -> finalIndex

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);

      if (parts[0] === 'f') {
        const faceIndices: number[] = [];

        for (let i = 1; i < parts.length; i++) {
          const vertex = parts[i];
          const components = vertex.split('/');
          const posIdx = parseInt(components[0]) - 1;
          const normIdx = components[2] ? parseInt(components[2]) - 1 : posIdx;

          const key = `${posIdx}//${normIdx}`;

          if (vertexCache.has(key)) {
            faceIndices.push(vertexCache.get(key)!);
          } else {
            const newIndex = finalPositions.length / 3;

            finalPositions.push(
              objPositions[posIdx * 3],
              objPositions[posIdx * 3 + 1],
              objPositions[posIdx * 3 + 2]
            );

            if (objNormals.length > 0) {
              finalNormals.push(
                objNormals[normIdx * 3],
                objNormals[normIdx * 3 + 1],
                objNormals[normIdx * 3 + 2]
              );
            } else {
              finalNormals.push(0, 1, 0);
            }

            vertexCache.set(key, newIndex);
            faceIndices.push(newIndex);
          }
        }

        for (let i = 1; i < faceIndices.length - 1; i++) {
          indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
        }
      }
    }

    if (objNormals.length === 0) {
      console.warn('OBJ не содержит нормалей, вычисляем автоматически');
      this.calculateNormals(finalPositions, finalNormals, indices);
    }

    console.log(`✓ Parsed OBJ: ${finalPositions.length / 3} vertices, ${indices.length / 3} triangles`);

    return {
      positions: new Float32Array(finalPositions),
      normals: new Float32Array(finalNormals),
      indices: indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices)
    };
  }

  private calculateNormals(positions: number[], normals: number[], indices: number[]) {
    for (let i = 0; i < normals.length; i++) {
      normals[i] = 0;
    }

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      const v0x = positions[i0 * 3], v0y = positions[i0 * 3 + 1], v0z = positions[i0 * 3 + 2];
      const v1x = positions[i1 * 3], v1y = positions[i1 * 3 + 1], v1z = positions[i1 * 3 + 2];
      const v2x = positions[i2 * 3], v2y = positions[i2 * 3 + 1], v2z = positions[i2 * 3 + 2];

      const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z;
      const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z;

      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;

      normals[i0 * 3] += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
      normals[i1 * 3] += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
      normals[i2 * 3] += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
    }

    for (let i = 0; i < normals.length; i += 3) {
      const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) {
        normals[i]   /= len;
        normals[i+1] /= len;
        normals[i+2] /= len;
      }
    }
  }
}
