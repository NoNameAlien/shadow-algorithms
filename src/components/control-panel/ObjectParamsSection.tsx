import { colorInputStyle } from './styles';
import type { Lang, MeshOption } from './types';
import { RangeControl, SelectControl } from './FormControls';
import { PanelSection } from './PanelSection';

const MATERIAL_PRESETS = [
  { key: 'matte', ru: 'Матовый', en: 'Matte', specular: 0.08, roughness: 0.82 },
  { key: 'plastic', ru: 'Пластик', en: 'Plastic', specular: 0.45, roughness: 0.46 },
  { key: 'glossy', ru: 'Глянец', en: 'Glossy', specular: 0.9, roughness: 0.18 }
];

type Props = {
  lang: Lang;
  objectColor: string;
  meshOptions: MeshOption[];
  activeMeshId: number;
  objectSpecular: number;
  objectShininess: number;
  objectRoughness: number;
  objectCastShadows: boolean;
  objectReceiveShadows: boolean;
  objectSelfShadows: boolean;
  onObjectColorChange: (hex: string) => void;
  onObjectMeshChange: (meshId: number) => void;
  onObjectSpecularChange: (value: number) => void;
  onObjectShininessChange: (value: number) => void;
  onObjectRoughnessChange: (value: number) => void;
  onObjectCastShadowsChange: (value: boolean) => void;
  onObjectReceiveShadowsChange: (value: boolean) => void;
  onObjectSelfShadowsChange: (value: boolean) => void;
};

export function ObjectParamsSection({
  lang,
  objectColor,
  meshOptions,
  activeMeshId,
  objectSpecular,
  objectShininess,
  objectRoughness,
  objectCastShadows,
  objectReceiveShadows,
  objectSelfShadows,
  onObjectColorChange,
  onObjectMeshChange,
  onObjectSpecularChange,
  onObjectShininessChange,
  onObjectRoughnessChange,
  onObjectCastShadowsChange,
  onObjectReceiveShadowsChange,
  onObjectSelfShadowsChange
}: Props) {
  return (
    <PanelSection>
      <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.85 }}>
        {lang === 'ru' ? 'Параметры объекта' : 'Object params'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{lang === 'ru' ? 'Цвет объекта' : 'Object color'}</span>
        <input
          type="color"
          value={objectColor}
          onChange={(event) => onObjectColorChange(event.target.value)}
          style={colorInputStyle}
        />
      </div>

      <SelectControl
        label={lang === 'ru' ? 'Модель объекта' : 'Object model'}
        value={activeMeshId}
        options={meshOptions.map((mesh) => ({ value: mesh.id, label: mesh.name || `Mesh ${mesh.id}` }))}
        onChange={onObjectMeshChange}
        marginBottom={6}
      />

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, marginBottom: 5, opacity: 0.85 }}>
          {lang === 'ru' ? 'Пресет материала' : 'Material preset'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {MATERIAL_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                onObjectSpecularChange(preset.specular);
                onObjectRoughnessChange(preset.roughness);
              }}
              style={{
                padding: '4px 6px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #343b4a',
                background: '#252a34',
                color: '#e6e6e6',
                cursor: 'pointer'
              }}
            >
              {lang === 'ru' ? preset.ru : preset.en}
            </button>
          ))}
        </div>
      </div>

      <RangeControl
        label={
          lang === 'ru'
            ? `Сила блика: ${objectSpecular.toFixed(2)}`
            : `Specular strength: ${objectSpecular.toFixed(2)}`
        }
        min={0}
        max={2}
        step={0.05}
        value={objectSpecular}
        onChange={onObjectSpecularChange}
        marginBottom={6}
      />

      <RangeControl
        label={
          lang === 'ru'
            ? `Шероховатость: ${objectRoughness.toFixed(2)}`
            : `Roughness: ${objectRoughness.toFixed(2)}`
        }
        min={0.02}
        max={1}
        step={0.02}
        value={objectRoughness}
        onChange={onObjectRoughnessChange}
        marginBottom={6}
      />

      <RangeControl
        label={lang === 'ru' ? `Shininess: ${objectShininess.toFixed(0)}` : `Legacy shininess: ${objectShininess.toFixed(0)}`}
        min={4}
        max={128}
        step={1}
        value={objectShininess}
        onChange={onObjectShininessChange}
        marginBottom={6}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={objectCastShadows}
          onChange={(event) => onObjectCastShadowsChange(event.target.checked)}
        />
        {lang === 'ru' ? 'Кидать тени' : 'Cast shadows'}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={objectReceiveShadows}
          onChange={(event) => onObjectReceiveShadowsChange(event.target.checked)}
        />
        {lang === 'ru' ? 'Принимать тени на объект' : 'Receive shadows on object'}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={objectSelfShadows}
          onChange={(event) => onObjectSelfShadowsChange(event.target.checked)}
        />
        {lang === 'ru' ? 'Самозатенение объекта' : 'Object self shadows'}
      </label>
    </PanelSection>
  );
}
