import { ControlPanel } from './components/ControlPanel';
import { SceneViewport } from './components/SceneViewport';
import { useRendererControls } from './hooks/useRendererControls';
import { useRendererLifecycle } from './hooks/useRendererLifecycle';

export default function App() {
  const { canvasRef, rendererRef, error, fps, isPointerLocked } = useRendererLifecycle();
  const { viewportProps, panelProps } = useRendererControls(rendererRef);

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
