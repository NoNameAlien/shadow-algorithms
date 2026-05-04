import { useEffect, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { SceneViewport } from './components/SceneViewport';
import { INITIAL_PARAMS } from './components/control-panel/constants';
import type { ShadowParams } from './components/control-panel/types';
import { useRendererLifecycle } from './hooks/useRendererLifecycle';
import { useSceneController } from './hooks/useSceneController';
import {
  downloadCanvasScreenshot,
  downloadReportCsv,
  downloadReportPdf,
  type ReportSnapshot
} from './utils/reportExport';

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
      />
    </div>
  );
}
