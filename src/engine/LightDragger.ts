import { vec3, mat4 } from 'gl-matrix';

export class LightDragger {
    private canvas: HTMLCanvasElement;
    private isDragging = false;
    private viewProj: mat4;
    private cameraPos: vec3;
    private onLightChange: (newLightDir: vec3) => void;

    constructor(
        canvas: HTMLCanvasElement,
        viewProj: mat4,
        cameraPos: vec3,
        onLightChange: (newLightDir: vec3) => void
    ) {
        this.canvas = canvas;
        this.viewProj = mat4.clone(viewProj);
        this.cameraPos = vec3.clone(cameraPos);
        this.onLightChange = onLightChange;
        this.setupHandlers();
    }

    private setupHandlers() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.shiftKey) {
                this.isDragging = true;
                this.canvas.style.cursor = 'move';
                e.preventDefault();
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const newLightDir = this.screenToWorldPlane(e.clientX, e.clientY);
            if (newLightDir) {
                vec3.normalize(newLightDir, newLightDir);
                this.onLightChange(newLightDir);
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'default';
            }
        });
    }

    private screenToWorldPlane(screenX: number, screenY: number): vec3 | null {
        const x = (2.0 * screenX) / this.canvas.width - 1.0;
        const y = 1.0 - (2.0 * screenY) / this.canvas.height;

        const invViewProj = mat4.create();
        const success = mat4.invert(invViewProj, this.viewProj);

        if (!success) {
            console.warn('Failed to invert view-projection matrix');
            return null;
        }

        const nearPoint = vec3.fromValues(x, y, -1);
        const farPoint = vec3.fromValues(x, y, 1);

        const worldNear = vec3.transformMat4(vec3.create(), nearPoint, invViewProj);
        const worldFar = vec3.transformMat4(vec3.create(), farPoint, invViewProj);

        const rayDir = vec3.subtract(vec3.create(), worldFar, worldNear);
        vec3.normalize(rayDir, rayDir);

        const t = -this.cameraPos[1] / rayDir[1];

        if (t > 0) {
            const intersectPoint = vec3.create();
            vec3.scaleAndAdd(intersectPoint, this.cameraPos, rayDir, t);

            const lightDir = vec3.subtract(vec3.create(), intersectPoint, [0, 0, 0]);
            lightDir[1] = 3.0;
            vec3.normalize(lightDir, lightDir);

            return lightDir;
        }

        return null;
    }

    updateCamera(viewProj: mat4, cameraPos: vec3) {
        mat4.copy(this.viewProj, viewProj);
        vec3.copy(this.cameraPos, cameraPos);
    }
}
