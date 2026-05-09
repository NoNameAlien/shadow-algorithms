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
  vsmBleedingTest: { startTheta: Math.atan2(4, 5), arc: Math.PI * 0.08, phi: Math.acos(3.5 / Math.hypot(4, 3.5, 5)), distance: Math.hypot(4, 3.5, 5) }
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

  const captureBenchmarkScreenshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    await waitForFrames(1);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.72),
      width: canvas.width,
      height: canvas.height
    };
  };

  const runSmoothBenchmarkOrbit = async (
    config: { startTheta: number; arc: number; phi: number; distance: number },
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
        config.distance
      );
      await waitForFrames(1);
      elapsed = performance.now() - start;
    }

    renderer.setBenchmarkOrbitView(config.startTheta + config.arc, config.phi, config.distance);
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
          await waitForFrames(4);
          await wait(warmupMs);
          renderer.resetPerformanceMetrics();
          await runSmoothBenchmarkOrbit(cameraConfig, sampleMs);

          const screenshot = await captureBenchmarkScreenshot();
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

      renderer.importScene(originalScene);
      setShadowParams(originalParams);

      const report = {
        timestamp: new Date().toISOString(),
        scenePresets: BENCHMARK_PRESETS,
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
        shadowDebugMode={shadowParams.debugShadowMap ?? 'off'}
        shadowMethod={shadowParams.method}
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
