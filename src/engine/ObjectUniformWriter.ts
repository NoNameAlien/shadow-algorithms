import { mat4 } from "gl-matrix";
import type { ObjectDrawStateRegistry } from "./ObjectDrawStateRegistry";
import type { SceneObject } from "./types";

export type ObjectUniformWriteContext = {
  viewProj: mat4;
  lightViewProjs: mat4[];
  lightPos: ArrayLike<number>;
  camPos: ArrayLike<number>;
  lightSelected: boolean;
  shadowParamsUniform: Float32Array;
  shadowSlotParamsUniforms?: Float32Array[];
  rotation: mat4;
  maxShadowSlots: number;
};

export class ObjectUniformWriter {
  private uniformData = new Float32Array(60);
  private objectParams = new Float32Array(8);
  private model = mat4.create();

  writeObjects(
    device: GPUDevice,
    objects: SceneObject[],
    drawStates: ObjectDrawStateRegistry,
    context: ObjectUniformWriteContext,
  ): void {
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const state = drawStates.get(i);
      this.writeObjectModelMatrix(this.model, obj, context.rotation);

      this.fillObjectUniformData(
        this.uniformData,
        this.model,
        context.viewProj,
        context.lightViewProjs[0],
        context.lightPos,
        context.camPos,
        context.lightSelected,
        context.shadowParamsUniform,
      );
      device.queue.writeBuffer(state.mainUniformBuf, 0, this.uniformData);

      for (let slotIndex = 0; slotIndex < context.maxShadowSlots; slotIndex++) {
        this.fillObjectUniformData(
          this.uniformData,
          this.model,
          context.viewProj,
          context.lightViewProjs[slotIndex],
          context.lightPos,
          context.camPos,
          context.lightSelected,
          context.shadowSlotParamsUniforms?.[slotIndex] ?? context.shadowParamsUniform,
        );
        device.queue.writeBuffer(state.shadowUniformBufs[slotIndex], 0, this.uniformData);
      }

      this.fillObjectParams(this.objectParams, obj);
      device.queue.writeBuffer(state.objectParamsBuf, 0, this.objectParams);
    }
  }

  private writeObjectModelMatrix(out: mat4, obj: SceneObject, rotation: mat4): void {
    mat4.fromTranslation(out, obj.pos);
    mat4.multiply(out, out, rotation);
    mat4.scale(out, out, obj.scale);
  }

  private fillObjectUniformData(
    target: Float32Array,
    model: mat4,
    viewProj: mat4,
    lightViewProj: mat4,
    lightPos: ArrayLike<number>,
    camPos: ArrayLike<number>,
    lightSelected: boolean,
    shadowParamsUniform: Float32Array,
  ): void {
    target.set(model, 0);
    target.set(viewProj, 16);
    target.set(lightViewProj, 32);
    target[48] = lightPos[0];
    target[49] = lightPos[1];
    target[50] = lightPos[2];
    target[51] = lightSelected ? 1 : 0;
    target[52] = camPos[0];
    target[53] = camPos[1];
    target[54] = camPos[2];
    target[55] = 1.0;
    target.set(shadowParamsUniform, 56);
  }

  private fillObjectParams(target: Float32Array, obj: SceneObject): void {
    target[0] = obj.color[0];
    target[1] = obj.color[1];
    target[2] = obj.color[2];
    target[3] = obj.receiveShadows ? 1.0 : 0.0;
    target[4] = obj.specular;
    target[5] = obj.shininess;
    target[6] = obj.selfShadows ? 1.0 : 0.0;
    target[7] = obj.roughness;
  }
}
