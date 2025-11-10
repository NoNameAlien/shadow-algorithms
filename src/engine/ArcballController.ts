import { quat, vec3, mat4 } from 'gl-matrix';

type RotationState = 'animated' | 'paused' | 'dragging';

export class ArcballController {
    private rotation = quat.create();
    private angularVelocity = vec3.fromValues(0.7, 0.4, 0);
    private state: RotationState = 'animated';
    private pauseEndTime = 0;
    private lastMousePos = { x: 0, y: 0 };
    private isDragging = false;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupHandlers();
    }

    private setupHandlers() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.state = 'dragging';
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grab';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;

            const sensitivity = 0.01;
            const deltaQuat = quat.create();
            quat.fromEuler(deltaQuat, -dy * sensitivity * 180 / Math.PI, -dx * sensitivity * 180 / Math.PI, 0);
            quat.multiply(this.rotation, deltaQuat, this.rotation);

            this.lastMousePos = { x: e.clientX, y: e.clientY };
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.state = 'paused';
            this.pauseEndTime = performance.now() + 5000;
            this.canvas.style.cursor = 'default';
        });
    }

    update(deltaTime: number): mat4 {
        const now = performance.now();

        if (this.state === 'paused' && now > this.pauseEndTime) {
            this.state = 'animated';
        }

        if (this.state === 'animated') {
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
}
