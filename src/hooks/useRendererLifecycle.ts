import { useEffect, useRef, useState } from 'react';
import { Renderer, type PerformanceMetrics } from '../engine/Renderer';

const INITIAL_PERFORMANCE_METRICS: PerformanceMetrics = {
  fps: 0,
  averageFps: 0,
  recentMinFps: 0,
  recentMaxFps: 0,
  sessionMinFps: 0,
  sessionMaxFps: 0,
  frameTimeMs: 0,
  averageFrameTimeMs: 0,
  maxFrameTimeMs: 0,
  frameTimeHistory: [],
  sampleDurationMs: 0
};

export const useRendererLifecycle = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>(INITIAL_PERFORMANCE_METRICS);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!canvasRef.current) return;

        const renderer = new Renderer(canvasRef.current);
        await renderer.init();
        renderer.setPerformanceCallback(setPerformanceMetrics);
        renderer.start();
        rendererRef.current = renderer;
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
      }
    })();

    const checkPointerLock = setInterval(() => {
      if (rendererRef.current?.cameraController) {
        setIsPointerLocked(rendererRef.current.cameraController.isLocked());
      }
    }, 100);

    return () => {
      clearInterval(checkPointerLock);
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  return {
    canvasRef,
    rendererRef,
    error,
    fps: performanceMetrics.fps,
    performanceMetrics,
    resetPerformanceMetrics: () => rendererRef.current?.resetPerformanceMetrics(),
    isPointerLocked
  };
};
