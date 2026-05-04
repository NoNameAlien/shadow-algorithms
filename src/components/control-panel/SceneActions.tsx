import type { RefObject } from 'react';
import type { Lang } from './types';

type Props = {
  lang: Lang;
  sceneFileInputRef: RefObject<HTMLInputElement | null>;
  onSaveScene?: () => void;
  onLoadSceneFile?: (file: File) => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onExportScreenshot?: () => void;
};

export function SceneActions({
  lang,
  sceneFileInputRef,
  onSaveScene,
  onLoadSceneFile,
  onExportCsv,
  onExportPdf,
  onExportScreenshot
}: Props) {
  const buttonBase = {
    padding: 6,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
      <button
        type="button"
        onClick={onSaveScene}
        style={{
          ...buttonBase,
          flex: 1,
          background: '#228be6'
        }}
      >
        {lang === 'ru' ? 'Сохранить сцену' : 'Save scene'}
      </button>
      <button
        type="button"
        onClick={() => sceneFileInputRef.current?.click()}
        style={{
          ...buttonBase,
          flex: 1,
          background: '#495057'
        }}
      >
        {lang === 'ru' ? 'Загрузить сцену' : 'Load scene'}
      </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <button type="button" onClick={onExportCsv} style={{ ...buttonBase, background: '#2f9e44' }}>
          CSV
        </button>
        <button type="button" onClick={onExportPdf} style={{ ...buttonBase, background: '#6741d9' }}>
          PDF
        </button>
        <button type="button" onClick={onExportScreenshot} style={{ ...buttonBase, background: '#e67700' }}>
          {lang === 'ru' ? 'Скрин' : 'Shot'}
        </button>
      </div>
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
