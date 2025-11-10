// import { vec3, mat4 } from 'gl-matrix';

// export class LightController {
//     private lightPos: vec3;
//     private isDragging = false;
//     private canvas: HTMLCanvasElement;
//     private camera: { view: mat4; proj: mat4 };

//     constructor(canvas: HTMLCanvasElement, initialPos: vec3) {
//         this.canvas = canvas;
//         this.lightPos = vec3.clone(initialPos);
//         this.setupMouseHandlers();
//     }

//     private setupMouseHandlers() {
//         this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
//         this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
//         this.canvas.addEventListener('mouseup', () => this.isDragging = false);
//     }

//     private onMouseDown(e: MouseEvent) {
//         const hit = this.rayCastToSphere(e.clientX, e.clientY);
//         if (hit) {
//             this.isDragging = true;
//             this.canvas.style.cursor = 'move';
//         }
//     }

//     private onMouseMove(e: MouseEvent) {
//         if (!this.isDragging) return;

//         // Проецируем движение мыши в 3D пространство
//         const ray = this.screenToWorldRay(e.clientX, e.clientY);
//         // Двигаем свет по плоскости перпендикулярной камере на фиксированном расстоянии
//         const distance = vec3.length(this.lightPos);
//         vec3.scale(this.lightPos, ray.direction, distance);
//     }

//     private rayCastToSphere(screenX: number, screenY: number): boolean {
//         const ray = this.screenToWorldRay(screenX, screenY);
//         // Проверка пересечения луча со сферой радиуса 0.3 в позиции lightPos
//         const sphereRadius = 0.3;
//         const oc = vec3.sub(vec3.create(), ray.origin, this.lightPos);
//         const a = vec3.dot(ray.direction, ray.direction);
//         const b = 2.0 * vec3.dot(oc, ray.direction);
//         const c = vec3.dot(oc, oc) - sphereRadius * sphereRadius;
//         const discriminant = b * b - 4 * a * c;
//         return discriminant > 0;
//     }

//     private screenToWorldRay(screenX: number, screenY: number) {
//         // NDC координаты
//         const x = (2.0 * screenX) / this.canvas.width - 1.0;
//         const y = 1.0 - (2.0 * screenY) / this.canvas.height;

//         // Обратная проекция
//         const invProj = mat4.invert(mat4.create(), this.camera.proj);
//         const invView = mat4.invert(mat4.create(), this.camera.view);

//         const rayClip = vec3.fromValues(x, y, -1.0);
//         const rayEye = vec3.transformMat4(vec3.create(), rayClip, invProj);
//         const rayWorld = vec3.transformMat4(vec3.create(), rayEye, invView);
//         vec3.normalize(rayWorld, rayWorld);

//         return { origin: this.getCameraPos(), direction: rayWorld };
//     }

//     getLightPosition(): vec3 {
//         return this.lightPos;
//     }
// }
