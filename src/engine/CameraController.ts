import { vec3, mat4 } from 'gl-matrix';

type ControlMode = 'orbit' | 'fps';

export class CameraController {
    private canvas: HTMLCanvasElement;

    // Orbit mode
    private target = vec3.fromValues(0, 0, 0);
    private distance = 8.0;
    private theta = Math.PI / 4; // 45° горизонтально
    private phi = Math.PI / 3; // 60° вертикально

    // FPS mode
    private position = vec3.fromValues(4, 3.5, 5);
    private yaw = 0;
    private pitch = 0;

    // Стартовые значения (для reset и init)
    private readonly defaultPosition = vec3.fromValues(4, 3.5, 5);
    private readonly defaultTarget = vec3.fromValues(0, 0, 0);

    private mode: ControlMode = 'orbit';
    private keys = new Set<string>();
    private moveSpeed = 5.0;
    private rotateSpeed = 1.5;
    private mouseSensitivity = 0.002;
    private isPointerLocked = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        // Стартовая позиция камеры
        vec3.copy(this.position, this.defaultPosition);
        vec3.copy(this.target, this.defaultTarget);

        this.setupHandlers();
        this.syncFromPosition();
    }

    // Синхронизирует orbit (distance/theta/phi) и FPS (yaw/pitch) с текущей позицией
    private syncFromPosition() {
        // Orbit: рассчитываем distance/theta/phi из позиции
        const toEye = vec3.subtract(vec3.create(), this.position, this.target);
        const r = vec3.length(toEye);
        this.distance = r;

        if (r > 0.0001) {
            const dir = vec3.scale(vec3.create(), toEye, 1 / r);
            // phi — угол от оси Y
            this.phi = Math.acos(dir[1]);
            // theta — угол в плоскости XZ
            this.theta = Math.atan2(dir[0], dir[2]);
        } else {
            this.phi = Math.PI / 3;
            this.theta = Math.PI / 4;
        }

        // FPS: yaw/pitch из направления на target
        const forward = vec3.subtract(vec3.create(), this.target, this.position);
        if (vec3.length(forward) > 0.0001) {
            vec3.normalize(forward, forward);
            this.yaw = Math.atan2(forward[0], forward[2]);
            this.pitch = Math.asin(forward[1]);
        } else {
            this.yaw = 0;
            this.pitch = 0;
        }
    }

    private setupHandlers() {
        // Клавиатура
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key.toLowerCase());
            this.keys.add(e.code);
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
            this.keys.delete(e.code);
        });

        // Ctrl+Click для входа в FPS режим
        this.canvas.addEventListener('click', (e) => {
            if (e.ctrlKey && !this.isPointerLocked) {
                this.mode = 'fps';
                this.canvas.requestPointerLock();
            }
        });

        // Pointer lock состояние
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
            if (!this.isPointerLocked) {
                this.mode = 'orbit'; // Выход из FPS режима
                console.log('Exited FPS mode, returned to orbit');
            } else {
                console.log('Entered FPS mode');
            }
        });

        // Движение мыши
        document.addEventListener('mousemove', (e) => {
            if (this.mode === 'fps' && this.isPointerLocked) {
                // FPS режим — вращение взгляда
                this.yaw -= e.movementX * this.mouseSensitivity;
                this.pitch -= e.movementY * this.mouseSensitivity;
                this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
            }
        });

        // Колесико мыши — zoom в orbit режиме
        this.canvas.addEventListener('wheel', (e) => {
            if (this.mode === 'orbit') {
                e.preventDefault();
                this.distance += e.deltaY * 0.01;
                this.distance = Math.max(2, Math.min(30, this.distance));
            }
        }, { passive: false });

        // ESC для выхода
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPointerLocked) {
                document.exitPointerLock();
            }
        });
    }

    update(deltaTime: number) {
        if (this.mode === 'orbit') {
            this.updateOrbit(deltaTime);
        } else {
            this.updateFPS(deltaTime);
        }
    }

    private updateOrbit(deltaTime: number) {
        // WASD/стрелки вращают камеру вокруг центра
        if (this.keys.has('a') || this.keys.has('arrowleft')) {
            this.theta += this.rotateSpeed * deltaTime;
        }
        if (this.keys.has('d') || this.keys.has('arrowright')) {
            this.theta -= this.rotateSpeed * deltaTime;
        }
        if (this.keys.has('w') || this.keys.has('arrowup')) {
            this.phi = Math.max(0.1, this.phi - this.rotateSpeed * deltaTime);
        }
        if (this.keys.has('s') || this.keys.has('arrowdown')) {
            this.phi = Math.min(Math.PI - 0.1, this.phi + this.rotateSpeed * deltaTime);
        }

        // Вычисляем позицию из orbit параметров
        this.position = vec3.fromValues(
            this.target[0] + this.distance * Math.sin(this.phi) * Math.cos(this.theta),
            this.target[1] + this.distance * Math.cos(this.phi),
            this.target[2] + this.distance * Math.sin(this.phi) * Math.sin(this.theta)
        );
    }

    private updateFPS(deltaTime: number) {
        // Направление взгляда (из getTarget, но без повторного clamp'а)
        const target = this.getTarget();
        const forward = vec3.subtract(vec3.create(), target, this.position);

        // Движение только в плоскости XZ
        forward[1] = 0;
        if (vec3.length(forward) > 0.0001) {
            vec3.normalize(forward, forward);
        }

        // Правый вектор = forward × up
        const up = vec3.fromValues(0, 1, 0);
        const right = vec3.cross(vec3.create(), forward, up);
        if (vec3.length(right) > 0.0001) {
            vec3.normalize(right, right);
        }

        const speed = this.moveSpeed * deltaTime;

        // Вперёд/назад: W/S и стрелки Up/Down
        let moveForward = 0;
        if (this.keys.has('w') || this.keys.has('arrowup')) moveForward += 1;
        if (this.keys.has('s') || this.keys.has('arrowdown')) moveForward -= 1;

        // Влево/вправо: A/D и стрелки Left/Right
        let moveRight = 0;
        if (this.keys.has('d') || this.keys.has('arrowright')) moveRight += 1;
        if (this.keys.has('a') || this.keys.has('arrowleft')) moveRight -= 1;

        if (moveForward !== 0) {
            vec3.scaleAndAdd(this.position, this.position, forward, moveForward * speed);
        }
        if (moveRight !== 0) {
            vec3.scaleAndAdd(this.position, this.position, right, moveRight * speed);
        }

        // Space/Shift вертикаль
        if (this.keys.has(' ') || this.keys.has('space')) {
            this.position[1] += speed;
        }
        if (this.keys.has('shift')) {
            this.position[1] -= speed;
        }
    }

    getCameraPosition(): vec3 {
        return vec3.clone(this.position);
    }

    getTarget(): vec3 {
        if (this.mode === 'orbit') {
            return vec3.clone(this.target);
        } else {
            // FPS — смотрим в направлении yaw/pitch
            return vec3.fromValues(
                this.position[0] + Math.sin(this.yaw) * Math.cos(this.pitch),
                this.position[1] + Math.sin(this.pitch),
                this.position[2] + Math.cos(this.yaw) * Math.cos(this.pitch)
            );
        }
    }

    getViewMatrix(): mat4 {
        const view = mat4.create();
        const target = this.getTarget();
        mat4.lookAt(view, this.position, target, [0, 1, 0]);
        return view;
    }

    reset() {
        this.mode = 'orbit';

        // Возвращаем позицию и цель к дефолтным
        vec3.copy(this.position, this.defaultPosition);
        vec3.copy(this.target, this.defaultTarget);

        // Синхронизируем orbit (distance/theta/phi) и FPS (yaw/pitch)
        this.syncFromPosition();

        if (this.isPointerLocked) {
            document.exitPointerLock();
        }

        console.log('Camera reset to orbit mode');
    }


    isLocked(): boolean {
        return this.isPointerLocked;
    }

    getMode(): ControlMode {
        return this.mode;
    }
}
