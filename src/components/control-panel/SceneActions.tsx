import type { RefObject } from 'react';
import { SCENE_PRESET_OPTIONS, type ScenePresetId } from '../../engine/presets';
import { SelectControl } from './FormControls';
import { PanelSection } from './PanelSection';
import { primaryButtonStyle, subtleButtonStyle } from './styles';
import type { Lang, ScenePresetSelection } from './types';

type Props = {
  lang: Lang;
  sceneFileInputRef: RefObject<HTMLInputElement | null>;
  onSaveScene?: () => void;
  onLoadSceneFile?: (file: File) => void;
  activeScenePreset: ScenePresetSelection;
  onScenePresetChange: (presetId: ScenePresetId) => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onExportScreenshot?: () => void;
};

export function SceneActions({
  lang,
  sceneFileInputRef,
  onSaveScene,
  onLoadSceneFile,
  activeScenePreset,
  onScenePresetChange,
  onExportCsv,
  onExportPdf,
  onExportScreenshot
}: Props) {
  return (
    <PanelSection title={lang === 'ru' ? 'Сцена и экспорт' : 'Scene & export'}>
      <SelectControl
        label={lang === 'ru' ? 'Preset сцена' : 'Scene preset'}
        value={activeScenePreset}
        options={[
          { value: 'custom' as const, label: lang === 'ru' ? 'Пользовательская' : 'Custom' },
          ...SCENE_PRESET_OPTIONS.map((preset) => ({
            value: preset.id,
            label: preset.label[lang]
          }))
        ]}
        onChange={(value) => {
          if (value !== 'custom') onScenePresetChange(value);
        }}
        marginBottom={8}
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button
          type="button"
          onClick={onSaveScene}
          style={{
            ...primaryButtonStyle,
            padding: 6,
            flex: 1
          }}
        >
          {lang === 'ru' ? 'Сохранить сцену' : 'Save scene'}
        </button>
        <button
          type="button"
          onClick={() => sceneFileInputRef.current?.click()}
          style={{
            ...subtleButtonStyle,
            padding: 6,
            flex: 1
          }}
        >
          {lang === 'ru' ? 'Загрузить сцену' : 'Load scene'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <button type="button" onClick={onExportCsv} style={{ ...subtleButtonStyle, padding: 6 }}>
          CSV
        </button>
        <button type="button" onClick={onExportPdf} style={{ ...subtleButtonStyle, padding: 6 }}>
          PDF
        </button>
        <button type="button" onClick={onExportScreenshot} style={{ ...subtleButtonStyle, padding: 6 }}>
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
    </PanelSection>
  );
}
