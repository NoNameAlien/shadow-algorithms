import type { RefObject } from 'react';
import { fileButtonStyle } from './styles';
import type { ControlPanelStrings, Lang } from './types';
import { PanelSection } from './PanelSection';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  modelName: string | null;
  modelInputRef: RefObject<HTMLInputElement | null>;
  objectTextureInputRef: RefObject<HTMLInputElement | null>;
  floorTextureInputRef: RefObject<HTMLInputElement | null>;
  onModelNameChange: (name: string | null) => void;
  onLoadModel: (file: File) => void;
  onResetModel?: () => void;
  onLoadObjectTexture?: (file: File) => void;
  onLoadFloorTexture?: (file: File) => void;
};

function FileRow({
  buttonText,
  description,
  onClick
}: {
  buttonText: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <button type="button" onClick={onClick} style={fileButtonStyle}>
        {buttonText}
      </button>
      <span style={{ flexGrow: 1, fontSize: 12, opacity: 0.6 }}>{description}</span>
    </div>
  );
}

export function AssetsSection({
  lang,
  strings,
  modelName,
  modelInputRef,
  objectTextureInputRef,
  floorTextureInputRef,
  onModelNameChange,
  onLoadModel,
  onResetModel,
  onLoadObjectTexture,
  onLoadFloorTexture
}: Props) {
  return (
    <PanelSection>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 4, opacity: 0.8 }}>
        {strings.objectTexture}
      </label>
      <FileRow
        buttonText={strings.chooseObj}
        description={lang === 'ru' ? 'Изображение для объекта' : 'Image for object'}
        onClick={() => objectTextureInputRef.current?.click()}
      />
      <input
        ref={objectTextureInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onLoadObjectTexture) onLoadObjectTexture(file);
        }}
        style={{ display: 'none' }}
      />

      <label style={{ display: 'block', fontSize: 13, marginBottom: 4, opacity: 0.8 }}>
        {strings.floorTexture}
      </label>
      <FileRow
        buttonText={strings.chooseObj}
        description={lang === 'ru' ? 'Изображение для пола' : 'Image for floor'}
        onClick={() => floorTextureInputRef.current?.click()}
      />
      <input
        ref={floorTextureInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onLoadFloorTexture) onLoadFloorTexture(file);
        }}
        style={{ display: 'none' }}
      />

      <label style={{ display: 'block', fontSize: 13, marginBottom: 4, marginTop: 4, opacity: 0.8 }}>
        {strings.loadModel}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => modelInputRef.current?.click()} style={fileButtonStyle}>
          {strings.chooseObj}
        </button>

        <span
          style={{
            flexGrow: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
            opacity: modelName ? 1 : 0.6
          }}
          title={modelName || strings.noModel}
        >
          {modelName ? (modelName.length > 18 ? `${modelName.slice(0, 18)}…` : modelName) : strings.noModel}
        </span>

        {modelName && (
          <button
            type="button"
            onClick={() => {
              onModelNameChange(null);
              if (modelInputRef.current) modelInputRef.current.value = '';
              onResetModel?.();
            }}
            style={{ border: 'none', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 16, padding: 0 }}
            title={strings.removeModel}
          >
            ×
          </button>
        )}
      </div>

      <input
        ref={modelInputRef}
        type="file"
        accept=".obj"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onModelNameChange(file.name);
            onLoadModel(file);
          }
        }}
        style={{ display: 'none' }}
      />
    </PanelSection>
  );
}
