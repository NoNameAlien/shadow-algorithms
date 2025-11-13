import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';

export type ModelData = {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint16Array | Uint32Array;
};

export class ModelLoader {
    async loadGLTF(url: string): Promise<ModelData> {
        const gltf = await load(url, GLTFLoader);

        if (!gltf.json?.meshes || gltf.json.meshes.length === 0) {
            throw new Error('GLTF не содержит mesh данных');
        }

        const meshIndex = gltf.json.meshes[0].primitives[0];
        const accessors = gltf.json.accessors || [];
        const bufferViews = gltf.json.bufferViews || [];

        const posAccessor = accessors[meshIndex.attributes.POSITION];
        const normAccessor = accessors[meshIndex.attributes.NORMAL];
        const idxAccessor = meshIndex.indices !== undefined ? accessors[meshIndex.indices] : null;

        if (!posAccessor || !normAccessor) {
            throw new Error('GLTF mesh не содержит position или normal данных');
        }

        const positions = this.getAccessorData(gltf, posAccessor, bufferViews);
        const normals = this.getAccessorData(gltf, normAccessor, bufferViews);
        const indices = idxAccessor
            ? this.getAccessorData(gltf, idxAccessor, bufferViews)
            : this.generateIndices(positions.length / 3);

        return {
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            indices: indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices)
        };
    }

    private getAccessorData(_gltf: any, _accessor: any, _bufferViews: any[]): number[] {
        console.warn('GLTF парсинг упрощен, используйте готовые библиотеки');
        return [];
    }

    private generateIndices(vertexCount: number): number[] {
        return Array.from({ length: vertexCount }, (_, i) => i);
    }

    async loadOBJ(url: string): Promise<ModelData> {
        const text = await fetch(url).then(r => r.text());
        return this.parseOBJ(text);
    }

    private parseOBJ(text: string): ModelData {
        const objPositions: number[] = []; // Временные массивы из файла
        const objNormals: number[] = [];

        const finalPositions: number[] = []; // Финальные развёрнутые данные
        const finalNormals: number[] = [];
        const indices: number[] = [];

        const lines = text.split('\n');

        // Шаг 1: Читаем все v и vn
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);

            if (parts[0] === 'v') {
                objPositions.push(+parts[1], +parts[2], +parts[3]);
            } else if (parts[0] === 'vn') {
                objNormals.push(+parts[1], +parts[2], +parts[3]);
            }
        }

        // Шаг 2: Обрабатываем грани и разворачиваем данные
        const vertexCache = new Map<string, number>(); // "posIdx//normIdx" -> finalIndex

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);

            if (parts[0] === 'f') {
                const faceIndices: number[] = [];

                for (let i = 1; i < parts.length; i++) {
                    const vertex = parts[i];
                    const components = vertex.split('/');
                    const posIdx = parseInt(components[0]) - 1; // OBJ индексы с 1
                    const normIdx = components[2] ? parseInt(components[2]) - 1 : posIdx;

                    const key = `${posIdx}//${normIdx}`;

                    // Если эта комбинация уже встречалась - переиспользуем
                    if (vertexCache.has(key)) {
                        faceIndices.push(vertexCache.get(key)!);
                    } else {
                        // Создаём новую вершину
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
                            // Если нормалей нет - добавим плейсхолдер (вычислим потом)
                            finalNormals.push(0, 1, 0);
                        }

                        vertexCache.set(key, newIndex);
                        faceIndices.push(newIndex);
                    }
                }

                // Триангуляция (если грань не треугольник)
                for (let i = 1; i < faceIndices.length - 1; i++) {
                    indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
                }
            }
        }

        // Шаг 3: Если нормалей не было, вычисляем из треугольников
        if (objNormals.length === 0) {
            console.warn('OBJ не содержит нормалей, вычисляем автоматически');
            this.calculateNormals(finalPositions, finalNormals, indices);
        }

        console.log(`✓ Parsed OBJ: ${finalPositions.length / 3} vertices, ${indices.length / 3} triangles`);

        return {
            positions: new Float32Array(finalPositions),
            normals: new Float32Array(finalNormals),
            indices: new Uint16Array(indices)
        };
    }

    private calculateNormals(positions: number[], normals: number[], indices: number[]) {
        // Обнуляем нормали
        for (let i = 0; i < normals.length; i++) {
            normals[i] = 0;
        }

        // Вычисляем нормали граней и накапливаем
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            const v0x = positions[i0 * 3], v0y = positions[i0 * 3 + 1], v0z = positions[i0 * 3 + 2];
            const v1x = positions[i1 * 3], v1y = positions[i1 * 3 + 1], v1z = positions[i1 * 3 + 2];
            const v2x = positions[i2 * 3], v2y = positions[i2 * 3 + 1], v2z = positions[i2 * 3 + 2];

            const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z;
            const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z;

            // Cross product
            let nx = e1y * e2z - e1z * e2y;
            let ny = e1z * e2x - e1x * e2z;
            let nz = e1x * e2y - e1y * e2x;

            // Накапливаем нормали для каждой вершины
            normals[i0 * 3] += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
            normals[i1 * 3] += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
            normals[i2 * 3] += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
        }

        // Нормализуем
        for (let i = 0; i < normals.length; i += 3) {
            const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len > 0) {
                normals[i] /= len;
                normals[i + 1] /= len;
                normals[i + 2] /= len;
            }
        }
    }
}
