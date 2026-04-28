import type { RefObject } from 'react';
import type { Lang } from './types';

type Props = {
  lang: Lang;
  sceneFileInputRef: RefObject<HTMLInputElement | null>;
  onSaveScene?: () => void;
  onLoadSceneFile?: (file: File) => void;
};

export function SceneActions({ lang, sceneFileInputRef, onSaveScene, onLoadSceneFile }: Props) {
  return (
    <div style={{ marginBottom: 8, display: 'flex', gap: 6 }}>
      <button
        type="button"
        onClick={onSaveScene}
        style={{
          flex: 1,
          padding: 6,
          background: '#228be6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600
        }}
      >
        {lang === 'ru' ? 'Сохранить сцену' : 'Save scene'}
      </button>
      <button
        type="button"
        onClick={() => sceneFileInputRef.current?.click()}
        style={{
          flex: 1,
          padding: 6,
          background: '#495057',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600
        }}
      >
        {lang === 'ru' ? 'Загрузить сцену' : 'Load scene'}
      </button>
      <input
        ref={sceneFileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onLoadSceneFile) onLoadSceneFile(file);
        }}
      />
    </div>
  );
}
