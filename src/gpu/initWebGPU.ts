type NavigatorWebGPU = Navigator & { gpu?: GPU };

function getGPUorThrow(): GPU {
    const nav = navigator as NavigatorWebGPU;
    const gpu = nav.gpu;
    if (!gpu) {
        throw new Error('WebGPU не поддерживается: navigator.gpu отсутствует. Открой в Chrome/Edge 113+ или включи флаг WebGPU.');
    }
    return gpu;
}

export async function initWebGPU(canvas: HTMLCanvasElement) {
    const gpu = getGPUorThrow();

    const adapter =
        (await gpu.requestAdapter({ powerPreference: 'high-performance' })) ??
        (await gpu.requestAdapter({ powerPreference: 'low-power' }));

    if (!adapter) {
        throw new Error('Не удалось получить GPU-адаптер (requestAdapter вернул null). Проверь поддержку WebGPU и драйверы.');
    }

    const device = await adapter.requestDevice();

    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu!.getPreferredCanvasFormat();

    const configure = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        canvas.width = w;
        canvas.height = h;
        context.configure({
            device,
            format,
            alphaMode: 'opaque'
        });
    };

    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    }

    configure();
    return { device, context, format, configure };
}
