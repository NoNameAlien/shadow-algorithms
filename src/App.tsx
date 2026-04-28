import { ControlPanel } from './components/ControlPanel';
import { SceneViewport } from './components/SceneViewport';
import { useRendererLifecycle } from './hooks/useRendererLifecycle';
import { useSceneController } from './hooks/useSceneController';

export default function App() {
  const { canvasRef, rendererRef, error, fps, isPointerLocked } = useRendererLifecycle();
  const { viewportProps, panelProps } = useSceneController(rendererRef);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#14161a', color: '#e6e6e6' }}>
      <SceneViewport canvasRef={canvasRef} error={error} {...viewportProps} />
      <ControlPanel
        isPointerLocked={isPointerLocked}
        fps={fps}
        {...panelProps}
      />
    </div>
  );
}
