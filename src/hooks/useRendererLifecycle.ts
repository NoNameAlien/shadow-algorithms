import { useEffect, useRef, useState } from 'react';
import { Renderer } from '../engine/Renderer';

export const useRendererLifecycle = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!canvasRef.current) return;

        const renderer = new Renderer(canvasRef.current);
        await renderer.init();
        renderer.setFpsCallback(setFps);
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
    fps,
    isPointerLocked
  };
};
