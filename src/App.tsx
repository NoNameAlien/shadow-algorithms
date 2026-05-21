import { useEffect, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { SceneViewport } from './components/SceneViewport';
import { INITIAL_PARAMS } from './components/control-panel/constants';
import type { ShadowParams } from './components/control-panel/types';
import { useRendererLifecycle } from './hooks/useRendererLifecycle';
import { useSceneController } from './hooks/useSceneController';
import {
  createBenchmarkSample,
  downloadBenchmarkArchive,
  downloadCanvasScreenshot,
  downloadReportCsv,
  downloadReportPdf,
  type ReportSnapshot
} from './utils/reportExport';
import type { ShadowMethod } from './engine/types';
import { SCENE_PRESETS, type ScenePresetId } from './engine/presets';
import { getAvailableShadowQualityPresets, getShadowMethodNotes, getShadowQualityLabel } from './utils/shadowQuality';

const BENCHMARK_PRESETS: ScenePresetId[] = [
  'aliasingTest',
  'penumbraTest',
  'multiLightTest',
  'vsmBleedingTest'
];

const BENCHMARK_CAMERA: Record<ScenePresetId, { startTheta: number; arc: number; phi: number; distance: number }> = {
  multipleObjects: { startTheta: Math.PI * 0.18, arc: Math.PI * 0.35, phi: Math.PI * 0.34, distance: 9.5 },
  stairs: { startTheta: Math.PI * 0.2, arc: Math.PI * 0.32, phi: Math.PI * 0.33, distance: 10 },
  forest: { startTheta: Math.PI * 0.25, arc: Math.PI * 0.3, phi: Math.PI * 0.35, distance: 11 },
  aliasingTest: { startTheta: Math.PI * 0.06, arc: Math.PI * 0.28, phi: Math.PI * 0.34, distance: 10.5 },
  penumbraTest: { startTheta: Math.PI * 0.2, arc: Math.PI * 0.3, phi: Math.PI * 0.34, distance: 9.5 },
  multiLightTest: { startTheta: -Math.PI * 0.72, arc: Math.PI * 0.25, phi: Math.PI * 0.36, distance: 9.2 },
  vsmBleedingTest: { startTheta: Math.PI * 0.34, arc: Math.PI * 0.34, phi: Math.PI * 0.36, distance: 13.2 }
};

const STAIRS_FOCUS_ID = 'stairsFocus';
const STAIRS_FOCUS_LABEL = 'Stairs shadow study';
const STAIRS_FOCUS_CAMERA = {
  startTheta: Math.PI * 0.82,
  arc: -Math.PI * 0.02,
  phi: Math.PI * 0.31,
  distance: 5.2,
  target: [0.65, -0.7, -0.1] as [number, number, number]
};

export default function App() {
  const {
    canvasRef,
    rendererRef,
    error,
    performanceMetrics,
    resetPerformanceMetrics,
    isPointerLocked
  } = useRendererLifecycle();
  const { viewportProps, panelProps } = useSceneController(rendererRef);
  const [shadowParams, setShadowParams] = useState<ShadowParams>(INITIAL_PARAMS);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);
  const [benchmarkOverlay, setBenchmarkOverlay] = useState<string | null>(null);
  const initialParamsAppliedRef = useRef(false);

  const handleShadowParamsChange = (params: ShadowParams) => {
    setShadowParams(params);
    panelProps.onParamsChange(params);
  };

  useEffect(() => {
    if (initialParamsAppliedRef.current || !rendererRef.current) return;

    initialParamsAppliedRef.current = true;
    panelProps.onParamsChange(INITIAL_PARAMS);
  }, [panelProps, rendererRef]);

  const createReportSnapshot = (): ReportSnapshot | null => {
    const renderer = rendererRef.current;
    if (!renderer) return null;

    return {
      timestamp: new Date().toISOString(),
      shadowParams,
      performanceMetrics,
      scene: renderer.exportScene()
    };
  };

  const reportFilename = (extension: string) => {
    const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d+Z$/, 'Z');
    return `shadow-report-${stamp}.${extension}`;
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const waitForFrames = async (count: number) => {
    for (let index = 0; index < count; index++) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
  };

  const drawScreenshotLabel = async (
    sourceCanvas: HTMLCanvasElement,
    label: string
  ): Promise<string> => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to prepare benchmark screenshot'));
      image.src = sourceCanvas.toDataURL('image/jpeg', 0.78);
    });

    const output = document.createElement('canvas');
    output.width = sourceCanvas.width;
    output.height = sourceCanvas.height;
    const ctx = output.getContext('2d');
    if (!ctx) return sourceCanvas.toDataURL('image/jpeg', 0.78);

    ctx.drawImage(image, 0, 0);
    const dpr = Math.max(1, sourceCanvas.width / Math.max(1, sourceCanvas.clientWidth));
    const x = Math.round(16 * dpr);
    const y = output.height - Math.round(18 * dpr);
    const fontSize = Math.max(13, Math.round(13 * dpr));
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(label);
    const paddingX = Math.round(8 * dpr);
    const paddingY = Math.round(5 * dpr);
    const boxHeight = fontSize + paddingY * 2;
    ctx.fillStyle = 'rgba(12, 14, 18, 0.78)';
    ctx.fillRect(x - paddingX, y - fontSize - paddingY, metrics.width + paddingX * 2, boxHeight);
    ctx.strokeStyle = 'rgba(180, 196, 230, 0.55)';
    ctx.strokeRect(x - paddingX, y - fontSize - paddingY, metrics.width + paddingX * 2, boxHeight);
    ctx.fillStyle = '#f3f6ff';
    ctx.fillText(label, x, y);
    return output.toDataURL('image/jpeg', 0.78);
  };

  const captureBenchmarkScreenshot = async (label?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    await waitForFrames(1);
    return {
      dataUrl: label ? await drawScreenshotLabel(canvas, label) : canvas.toDataURL('image/jpeg', 0.72),
      width: canvas.width,
      height: canvas.height
    };
  };

  const createBenchmarkOverlayLabel = (sceneLabel: string, params: ShadowParams) =>
    `${sceneLabel} | ${params.method} | ${getShadowQualityLabel(params, 'en')} | ${params.shadowMapSize}px | ${getShadowMethodNotes(params)}`;

  const getBenchmarkQualitySweep = (method: ShadowMethod) => {
    const presets = getAvailableShadowQualityPresets(method);
    const first = presets[0];
    const last = presets[presets.length - 1];
    return first && last && first.id !== last.id ? [first, last] : presets;
  };

  const tuneFocusedStairsParams = (params: ShadowParams): ShadowParams => {
    if (params.method !== 'PCSS' || params.shadowMapSize < 4096) return params;

    return {
      ...params,
      pcssLightSize: 0.22,
      pcssBlockerSearchSamples: 32
    };
  };

  const createFocusedStairsScene = () => {
    const renderer = rendererRef.current;
    if (!renderer) return null;

    renderer.applyScenePreset('stairs');
    const scene = renderer.exportScene();
    const floorY = -2.5;
    const cubeY = (halfHeight: number) => floorY + halfHeight;
    const sphereY = (scale: number) => floorY + 1.15 * scale;

    scene.showWalls = false;
    scene.showGrid = false;
    scene.floorSize = 16;
    scene.floorColor = [0.95, 0.94, 0.9];
    scene.wallColor = [0.95, 0.94, 0.9];
    scene.objects = [
      {
        name: 'Foreground step',
        pos: [-0.35, cubeY(0.48), -0.54],
        scale: [0.68, 0.48, 1.18],
        moveSpeed: 0,
        meshId: 1,
        color: [0.56, 0.36, 0.2],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.11,
        shininess: 22,
        roughness: 0.86
      },
      {
        name: 'Middle step',
        pos: [0.48, cubeY(0.78), -0.26],
        scale: [0.68, 0.78, 1.18],
        moveSpeed: 0,
        meshId: 0,
        color: [0.61, 0.4, 0.23],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.11,
        shininess: 22,
        roughness: 0.84
      },
      {
        name: 'Upper step',
        pos: [1.3, cubeY(1.08), 0.02],
        scale: [0.68, 1.08, 1.18],
        moveSpeed: 0,
        meshId: 1,
        color: [0.66, 0.44, 0.26],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.12,
        shininess: 24,
        roughness: 0.82
      },
      {
        name: 'Back step',
        pos: [2.12, cubeY(1.34), 0.3],
        scale: [0.62, 1.34, 1.08],
        moveSpeed: 0,
        meshId: 0,
        color: [0.7, 0.47, 0.28],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.12,
        shininess: 24,
        roughness: 0.8
      },
      {
        name: 'Contact slab',
        pos: [-1.3, cubeY(0.14), -1.0],
        scale: [0.9, 0.14, 0.34],
        moveSpeed: 0,
        meshId: 0,
        color: [0.48, 0.3, 0.17],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.1,
        shininess: 20,
        roughness: 0.9
      },
      {
        name: 'Low matte sphere',
        pos: [-1.05, sphereY(0.36), 0.84],
        scale: [0.36, 0.36, 0.36],
        moveSpeed: 0,
        meshId: 2,
        color: [0.7, 0.49, 0.3],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.13,
        shininess: 26,
        roughness: 0.8
      },
      {
        name: 'Slim side block',
        pos: [0.24, cubeY(0.72), 1.08],
        scale: [0.22, 0.72, 0.28],
        moveSpeed: 0,
        meshId: 1,
        color: [0.58, 0.38, 0.22],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.11,
        shininess: 22,
        roughness: 0.86
      },
      {
        name: 'Distant small block',
        pos: [2.4, cubeY(0.36), -1.02],
        scale: [0.34, 0.36, 0.34],
        moveSpeed: 0,
        meshId: 1,
        color: [0.64, 0.42, 0.24],
        castShadows: true,
        receiveShadows: true,
        selfShadows: true,
        specular: 0.1,
        shininess: 22,
        roughness: 0.84
      }
    ];

    scene.lights = scene.lights.map((light, index) => {
      if (index === 0) {
        return {
          ...light,
          name: 'Warm low key light',
          pos: [-5.8, 3.15, 4.25],
          type: 'spot',
          yaw: 2.16,
          pitch: -0.52,
          intensity: 4.35,
          color: [1.0, 0.94, 0.82],
          innerConeDeg: 24,
          outerConeDeg: 62,
          range: 25,
          falloff: 1.16,
          castShadows: true
        };
      }

      return {
        ...light,
        pos: [3.4, 4.8, -3.8],
        intensity: 0.32,
        color: [0.82, 0.88, 1.0],
        castShadows: false
      };
    });

    scene.shadowParams = {
      ...scene.shadowParams,
      shadowStrength: 1.36,
      ambientStrength: 0.15,
      exposure: 1.08,
      hemisphereSkyColor: [0.74, 0.78, 0.86],
      hemisphereGroundColor: [0.18, 0.18, 0.16],
      lightDebugMode: 'final',
      debugShadowMap: 'off'
    };

    return scene;
  };

  const runSmoothBenchmarkOrbit = async (
    config: { startTheta: number; arc: number; phi: number; distance: number; target?: [number, number, number] },
    durationMs: number
  ) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const start = performance.now();
    let elapsed = 0;

    while (elapsed < durationMs) {
      const progress = Math.min(1, elapsed / durationMs);
      const eased = progress * progress * (3 - 2 * progress);
      renderer.setBenchmarkOrbitView(
        config.startTheta + config.arc * eased,
        config.phi,
        config.distance,
        config.target
      );
      await waitForFrames(1);
      elapsed = performance.now() - start;
    }

    renderer.setBenchmarkOrbitView(config.startTheta + config.arc, config.phi, config.distance, config.target);
    await waitForFrames(2);
  };

  const handleRunBenchmark = async () => {
    const renderer = rendererRef.current;
    if (!renderer || isBenchmarkRunning) return;

    const originalParams = { ...shadowParams };
    const originalScene = renderer.exportScene();
    const originalAutoRotate = renderer.getObjectAutoRotate();
    const methods: ShadowMethod[] = ['SM', 'PCF', 'PCSS', 'VSM'];
    const warmupMs = 700;
    const sampleMs = 1800;
    const orbitSteps = 24;

    setIsBenchmarkRunning(true);

    try {
      const samples = [];
      renderer.setObjectAutoRotate(false);

      for (const presetId of BENCHMARK_PRESETS) {
        const preset = SCENE_PRESETS[presetId];
        const cameraConfig = BENCHMARK_CAMERA[presetId];
        renderer.applyScenePreset(presetId);
        renderer.setBenchmarkOrbitView(cameraConfig.startTheta, cameraConfig.phi, cameraConfig.distance);
        await waitForFrames(2);

        for (const method of methods) {
          const methodParams: ShadowParams = {
            ...originalParams,
            ...preset.shadowParams,
            method,
            lightDebugMode: 'final',
            debugShadowMap: 'off'
          };

          renderer.updateShadowParams(methodParams);
          renderer.setBenchmarkOrbitView(cameraConfig.startTheta, cameraConfig.phi, cameraConfig.distance);
          const overlayLabel = createBenchmarkOverlayLabel(preset.label.en, methodParams);
          setBenchmarkOverlay(overlayLabel);
          await waitForFrames(4);
          await wait(warmupMs);
          renderer.resetPerformanceMetrics();
          await runSmoothBenchmarkOrbit(cameraConfig, sampleMs);

          const screenshot = await captureBenchmarkScreenshot(overlayLabel);
          samples.push(createBenchmarkSample(
            presetId,
            preset.label.en,
            method,
            methodParams,
            renderer.getPerformanceMetrics(),
            screenshot,
          ));
        }
      }

      const focusedStairsScene = createFocusedStairsScene();
      if (focusedStairsScene) {
        const focusedSampleMs = Math.round(sampleMs * 2 / 3);
        renderer.importScene(focusedStairsScene);
        renderer.setBenchmarkOrbitView(
          STAIRS_FOCUS_CAMERA.startTheta,
          STAIRS_FOCUS_CAMERA.phi,
          STAIRS_FOCUS_CAMERA.distance,
          STAIRS_FOCUS_CAMERA.target
        );
        await waitForFrames(2);

        for (const method of methods) {
          for (const quality of getBenchmarkQualitySweep(method)) {
            const methodParams: ShadowParams = tuneFocusedStairsParams({
              ...originalParams,
              ...focusedStairsScene.shadowParams,
              ...quality.params,
              method,
              lightDebugMode: 'final',
              debugShadowMap: 'off'
            });

            renderer.updateShadowParams(methodParams);
            renderer.setBenchmarkOrbitView(
              STAIRS_FOCUS_CAMERA.startTheta,
              STAIRS_FOCUS_CAMERA.phi,
              STAIRS_FOCUS_CAMERA.distance,
              STAIRS_FOCUS_CAMERA.target
            );
            const overlayLabel = createBenchmarkOverlayLabel(STAIRS_FOCUS_LABEL, methodParams);
            setBenchmarkOverlay(overlayLabel);
            await waitForFrames(4);
            await wait(warmupMs);
            renderer.resetPerformanceMetrics();
            await runSmoothBenchmarkOrbit(STAIRS_FOCUS_CAMERA, focusedSampleMs);

            const screenshot = await captureBenchmarkScreenshot(overlayLabel);
            samples.push(createBenchmarkSample(
              STAIRS_FOCUS_ID,
              STAIRS_FOCUS_LABEL,
              method,
              methodParams,
              renderer.getPerformanceMetrics(),
              screenshot,
            ));
          }
        }
      }

      renderer.importScene(originalScene);
      setShadowParams(originalParams);

      const report = {
        timestamp: new Date().toISOString(),
        scenePresets: [...BENCHMARK_PRESETS, STAIRS_FOCUS_ID],
        warmupMs,
        sampleMs,
        orbitSteps,
        scene: originalScene,
        samples
      };

      const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d+Z$/, 'Z');
      downloadBenchmarkArchive(report, `shadow-benchmark-${stamp}`);
    } finally {
      renderer.importScene(originalScene);
      renderer.setObjectAutoRotate(originalAutoRotate);
      setShadowParams(originalParams);
      setBenchmarkOverlay(null);
      setIsBenchmarkRunning(false);
    }
  };

  const handleExportCsv = () => {
    const report = createReportSnapshot();
    if (!report) return;
    downloadReportCsv(report, reportFilename('csv'));
  };

  const handleExportPdf = () => {
    const report = createReportSnapshot();
    if (!report) return;
    downloadReportPdf(report, reportFilename('pdf'));
  };

  const handleExportScreenshot = () => {
    if (!canvasRef.current) return;
    downloadCanvasScreenshot(canvasRef.current, reportFilename('png'));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#14161a', color: '#e6e6e6' }}>
      <SceneViewport
        canvasRef={canvasRef}
        error={error}
        lang={panelProps.lang}
        performanceMetrics={performanceMetrics}
        onResetPerformanceMetrics={resetPerformanceMetrics}
        benchmarkOverlay={benchmarkOverlay}
        {...viewportProps}
      />
      <ControlPanel
        isPointerLocked={isPointerLocked}
        {...panelProps}
        onParamsChange={handleShadowParamsChange}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onExportScreenshot={handleExportScreenshot}
        onRunBenchmark={handleRunBenchmark}
        isBenchmarkRunning={isBenchmarkRunning}
      />
    </div>
  );
}
