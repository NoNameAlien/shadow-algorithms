import { vec3, mat4 } from 'gl-matrix';

export class CameraController {
    private canvas: HTMLCanvasElement;
    private target = vec3.fromValues(0, 0, 0); // Точка на которую смотрим
    private distance = 8.0; // Расстояние от target
    private theta = Math.PI / 4; // Угол по горизонтали (45°)
    private phi = Math.PI / 6; // Угол по вертикали (30°)
    private height = 0; // Дополнительная высота камеры

    private keys = new Set<string>();
    private moveSpeed = 3.0; // единиц/секунду
    private rotateSpeed = 1.5; // радиан/секунду
    private zoomSpeed = 5.0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupHandlers();
    }

    private setupHandlers() {
        // Клавиатура
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key.toLowerCase());
            this.keys.add(e.code); // Для стрелок
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
            this.keys.delete(e.code);
        });

        // Колесико мыши для zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.distance += e.deltaY * 0.01;
            this.distance = Math.max(2, Math.min(30, this.distance)); // Ограничиваем 2-30
        }, { passive: false });
    }

    update(deltaTime: number) {
        // WASD или стрелки - orbit вокруг центра
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

        // Пробел - подъём вверх
        if (this.keys.has(' ') || this.keys.has('space')) {
            this.height += this.moveSpeed * deltaTime;
        }

        // Shift - спуск вниз
        if (this.keys.has('shift')) {
            this.height -= this.moveSpeed * deltaTime;
        }

        // Q/E - zoom (альтернатива колесику)
        if (this.keys.has('q')) {
            this.distance = Math.max(2, this.distance - this.zoomSpeed * deltaTime);
        }
        if (this.keys.has('e')) {
            this.distance = Math.min(30, this.distance + this.zoomSpeed * deltaTime);
        }

        // Ограничиваем высоту
        this.height = Math.max(-10, Math.min(20, this.height));
    }

    getCameraPosition(): vec3 {
        // Сферические координаты в декартовы
        const x = this.target[0] + this.distance * Math.sin(this.phi) * Math.cos(this.theta);
        const y = this.target[1] + this.distance * Math.cos(this.phi) + this.height;
        const z = this.target[2] + this.distance * Math.sin(this.phi) * Math.sin(this.theta);

        return vec3.fromValues(x, y, z);
    }

    getTarget(): vec3 {
        // Target с учётом высоты
        return vec3.fromValues(
            this.target[0],
            this.target[1] + this.height * 0.5, // Следим за сдвигом вверх
            this.target[2]
        );
    }

    getViewMatrix(): mat4 {
        const view = mat4.create();
        const eye = this.getCameraPosition();
        const target = this.getTarget();
        mat4.lookAt(view, eye, target, [0, 1, 0]);
        return view;
    }

    reset() {
        this.distance = 8.0;
        this.theta = Math.PI / 4;
        this.phi = Math.PI / 6;
        this.height = 0;
    }
}
