import { quat, vec3, mat4 } from 'gl-matrix';

export class ArcballController {
    private rotation = quat.create();
    private angularVelocity = vec3.fromValues(0.7, 0.4, 0);
    private lastMousePos = { x: 0, y: 0 };
    private isDragging = false;
    private canvas: HTMLCanvasElement;
    public enabled = true;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupHandlers();
    }

    private setupHandlers() {
        this.canvas.addEventListener('mousedown', (e) => {
            // НЕ работаем если зажат Ctrl (FPS) или вращение выключено
            if (e.ctrlKey || !this.enabled) return;

            this.isDragging = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging || !this.enabled) return;

            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;

            const sensitivity = 0.01;
            const deltaQuat = quat.create();
            quat.fromEuler(
                deltaQuat,
                -dy * sensitivity * 180 / Math.PI,
                -dx * sensitivity * 180 / Math.PI,
                0
            );
            quat.multiply(this.rotation, deltaQuat, this.rotation);

            this.lastMousePos = { x: e.clientX, y: e.clientY };
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
        });
    }

    update(deltaTime: number): mat4 {
        // Если вращение отключено — просто вернуть матрицу из текущего quaternion
        if (!this.enabled) {
            const matrix = mat4.create();
            mat4.fromQuat(matrix, this.rotation);
            return matrix;
        }

        // Авто‑вращение: Renderer сам решает, какой deltaTime передавать (0 или >0)
        if (deltaTime > 0) {
            const deltaQuat = quat.create();
            const angle = vec3.length(this.angularVelocity) * deltaTime;
            const axis = vec3.normalize(vec3.create(), this.angularVelocity);
            quat.setAxisAngle(deltaQuat, axis, angle);
            quat.multiply(this.rotation, deltaQuat, this.rotation);
        }

        const matrix = mat4.create();
        mat4.fromQuat(matrix, this.rotation);
        return matrix;
    }

    getRotation(): quat {
        return quat.clone(this.rotation);
    }

    reset() {
        this.rotation = quat.create();
        console.log('Arcball rotation reset');
    }
}