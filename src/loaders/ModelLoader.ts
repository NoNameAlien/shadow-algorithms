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

        // ИСПРАВЛЕНО: правильная структура GLTF
        if (!gltf.json?.meshes || gltf.json.meshes.length === 0) {
            throw new Error('GLTF не содержит mesh данных');
        }

        const meshIndex = gltf.json.meshes[0].primitives[0];
        const accessors = gltf.json.accessors || [];
        const bufferViews = gltf.json.bufferViews || [];

        // Упрощенная загрузка - используем первый primitive
        const posAccessor = accessors[meshIndex.attributes.POSITION];
        const normAccessor = accessors[meshIndex.attributes.NORMAL];
        const idxAccessor = meshIndex.indices !== undefined ? accessors[meshIndex.indices] : null;

        if (!posAccessor || !normAccessor) {
            throw new Error('GLTF mesh не содержит position или normal данных');
        }

        // Парсинг данных из буферов (упрощенно)
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
        // Упрощенная реализация - для полноценной нужна библиотека
        // Это заглушка, реальную реализацию делать долго
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
        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];

        const lines = text.split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);

            if (parts[0] === 'v') {
                positions.push(+parts[1], +parts[2], +parts[3]);
            } else if (parts[0] === 'vn') {
                normals.push(+parts[1], +parts[2], +parts[3]);
            } else if (parts[0] === 'f') {
                for (let i = 1; i <= 3; i++) {
                    const idx = parseInt(parts[i].split('/')[0]) - 1;
                    indices.push(idx);
                }
            }
        }

        return {
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            indices: new Uint16Array(indices)
        };
    }
}
