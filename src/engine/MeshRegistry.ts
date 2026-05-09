import { SphereGenerator } from "../geometry/SphereGenerator";
import { ModelLoader } from "../loaders/ModelLoader";
import {
  createBeveledCubeGeometry,
  createCubeGeometry,
} from "./geometryData";
import { createBufferFromData } from "./resources";
import type { MeshDef } from "./types";

export class MeshRegistry {
  private meshes: MeshDef[] = [];
  private meshById = new Map<number, MeshDef>();
  private fallbackTbo: GPUBuffer | null = null;
  defaultMeshId = 0;

  createDefaultMeshes(device: GPUDevice): void {
    this.destroy();

    const cube = createCubeGeometry();
    const cubeMesh = this.createMeshFromGeometry(device, {
      id: 0,
      name: "Cube",
      positions: cube.positions,
      normals: cube.normals,
      uvs: cube.uvs,
      indices: cube.indices,
      indexFormat: "uint16",
    });
    this.fallbackTbo = cubeMesh.tbo;

    const beveled = createBeveledCubeGeometry();
    const beveledMesh = this.createMeshFromGeometry(device, {
      id: 1,
      name: "Bevelled cube",
      positions: beveled.positions,
      normals: beveled.normals,
      uvs: beveled.uvs,
      indices: beveled.indices,
      indexFormat: "uint16",
    });

    const sphere = SphereGenerator.createIcosphere(1.15, 3);
    const sphereMesh = this.createMeshFromGeometry(device, {
      id: 2,
      name: "Smooth sphere",
      positions: sphere.positions,
      normals: sphere.normals,
      uvs: new Float32Array((sphere.positions.length / 3) * 2),
      indices: sphere.indices,
      indexFormat: "uint16",
    });

    this.register(cubeMesh);
    this.register(beveledMesh);
    this.register(sphereMesh);
    this.defaultMeshId = cubeMesh.id;
  }

  async loadModelFile(device: GPUDevice, file: File): Promise<MeshDef> {
    const loader = new ModelLoader();
    const url = URL.createObjectURL(file);

    try {
      const model = await loader.loadOBJ(url);
      const id = this.getNextMeshId();
      const mesh: MeshDef = {
        id,
        name: file.name,
        vbo: createBufferFromData(device, model.positions, GPUBufferUsage.VERTEX),
        nbo: createBufferFromData(device, model.normals, GPUBufferUsage.VERTEX),
        tbo: this.fallbackTbo ?? createBufferFromData(
          device,
          new Float32Array((model.positions.length / 3) * 2),
          GPUBufferUsage.VERTEX,
        ),
        ibo: createBufferFromData(device, model.indices, GPUBufferUsage.INDEX),
        indexCount: model.indices.length,
        indexFormat: model.indexFormat,
      };

      this.register(mesh);
      return mesh;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  get(meshId: number): MeshDef {
    return this.meshById.get(meshId) ?? this.meshes[0];
  }

  has(meshId: number): boolean {
    return this.meshById.has(meshId);
  }

  getMeta(): Array<{ id: number; name: string }> {
    return this.meshes.map((mesh) => ({ id: mesh.id, name: mesh.name }));
  }

  destroy(): void {
    for (const mesh of this.meshes) {
      mesh.vbo.destroy();
      mesh.nbo.destroy();
      mesh.ibo.destroy();
      if (mesh.tbo !== this.fallbackTbo) {
        mesh.tbo.destroy();
      }
    }

    this.fallbackTbo?.destroy();
    this.fallbackTbo = null;
    this.meshes = [];
    this.meshById.clear();
    this.defaultMeshId = 0;
  }

  private createMeshFromGeometry(
    device: GPUDevice,
    params: {
      id: number;
      name: string;
      positions: Float32Array;
      normals: Float32Array;
      uvs: Float32Array;
      indices: Uint16Array | Uint32Array;
      indexFormat: GPUIndexFormat;
    },
  ): MeshDef {
    return {
      id: params.id,
      name: params.name,
      vbo: createBufferFromData(device, params.positions, GPUBufferUsage.VERTEX),
      nbo: createBufferFromData(device, params.normals, GPUBufferUsage.VERTEX),
      tbo: createBufferFromData(device, params.uvs, GPUBufferUsage.VERTEX),
      ibo: createBufferFromData(device, params.indices, GPUBufferUsage.INDEX),
      indexCount: params.indices.length,
      indexFormat: params.indexFormat,
    };
  }

  private register(mesh: MeshDef): void {
    this.meshes.push(mesh);
    this.meshById.set(mesh.id, mesh);
  }

  private getNextMeshId(): number {
    return this.meshes.length
      ? this.meshes[this.meshes.length - 1].id + 1
      : 0;
  }
}
