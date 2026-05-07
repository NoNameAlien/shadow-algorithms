import { useState, type ReactNode } from 'react';
import { colorInputStyle, subtleButtonStyle } from './styles';
import type { Lang, MeshOption, ObjectScale } from './types';
import { HelpMark, RangeControl, SelectControl } from './FormControls';
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
  objectScale: ObjectScale;
  objectSpecular: number;
  objectShininess: number;
  objectRoughness: number;
  objectMoveSpeed: number;
  objectCastShadows: boolean;
  objectReceiveShadows: boolean;
  objectSelfShadows: boolean;
  onObjectColorChange: (hex: string) => void;
  onObjectScaleChange: (scale: ObjectScale) => void;
  onObjectMeshChange: (meshId: number) => void;
  onObjectSpecularChange: (value: number) => void;
  onObjectShininessChange: (value: number) => void;
  onObjectRoughnessChange: (value: number) => void;
  onObjectMoveSpeedChange: (value: number) => void;
  onObjectCastShadowsChange: (value: boolean) => void;
  onObjectReceiveShadowsChange: (value: boolean) => void;
  onObjectSelfShadowsChange: (value: boolean) => void;
};

function DetailToggle({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a303c' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 0,
          background: 'transparent',
          color: '#e6e6e6',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600
        }}
      >
        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>{title}</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open ? <div style={{ marginTop: 8 }}>{children}</div> : null}
    </div>
  );
}

export function ObjectParamsSection({
  lang,
  objectColor,
  meshOptions,
  activeMeshId,
  objectScale,
  objectSpecular,
  objectShininess,
  objectRoughness,
  objectMoveSpeed,
  objectCastShadows,
  objectReceiveShadows,
  objectSelfShadows,
  onObjectColorChange,
  onObjectScaleChange,
  onObjectMeshChange,
  onObjectSpecularChange,
  onObjectShininessChange,
  onObjectRoughnessChange,
  onObjectMoveSpeedChange,
  onObjectCastShadowsChange,
  onObjectReceiveShadowsChange,
  onObjectSelfShadowsChange
}: Props) {
  const [materialOpen, setMaterialOpen] = useState(false);
  const [transformOpen, setTransformOpen] = useState(false);
  const [motionOpen, setMotionOpen] = useState(false);
  const uniformScale = (objectScale[0] + objectScale[1] + objectScale[2]) / 3;
  const updateScaleAxis = (axis: 0 | 1 | 2, value: number) => {
    const next: ObjectScale = [...objectScale] as ObjectScale;
    next[axis] = value;
    onObjectScaleChange(next);
  };

  return (
    <PanelSection title={lang === 'ru' ? 'Параметры объекта' : 'Object params'} collapsible={false}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
        <input
          type="color"
          value={objectColor}
          onChange={(event) => onObjectColorChange(event.target.value)}
          style={colorInputStyle}
        />
        {lang === 'ru' ? 'Цвет объекта' : 'Object color'}
        <HelpMark text={lang === 'ru' ? 'Базовый цвет активного объекта.' : 'Base color of the active object.'} />
      </label>

      <SelectControl
        label={lang === 'ru' ? 'Модель объекта' : 'Object model'}
        help={lang === 'ru' ? 'Переключает геометрию активного объекта без удаления его настроек.' : 'Switches active object geometry without removing its settings.'}
        value={activeMeshId}
        options={meshOptions.map((mesh) => ({ value: mesh.id, label: mesh.name || `Mesh ${mesh.id}` }))}
        onChange={onObjectMeshChange}
        marginBottom={6}
      />

      <div style={{ marginBottom: 0 }}>
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
                ...subtleButtonStyle,
                padding: '4px 6px',
                fontSize: 12
              }}
            >
              {lang === 'ru' ? preset.ru : preset.en}
            </button>
          ))}
        </div>
      </div>

      <DetailToggle
        title={lang === 'ru' ? 'Размер объекта' : 'Object scale'}
        open={transformOpen}
        onToggle={() => setTransformOpen((previous) => !previous)}
      >
        <RangeControl
          label={lang === 'ru' ? `Единый масштаб: ${uniformScale.toFixed(2)}` : `Uniform scale: ${uniformScale.toFixed(2)}`}
          help={lang === 'ru' ? 'Устанавливает одинаковый масштаб по X/Y/Z.' : 'Sets the same scale on X/Y/Z.'}
          min={0.05}
          max={10}
          step={0.05}
          value={uniformScale}
          onChange={(value) => onObjectScaleChange([value, value, value])}
          marginBottom={6}
        />

        <RangeControl
          label={`X: ${objectScale[0].toFixed(2)}`}
          min={0.05}
          max={10}
          step={0.05}
          value={objectScale[0]}
          onChange={(value) => updateScaleAxis(0, value)}
          marginBottom={6}
        />

        <RangeControl
          label={`Y: ${objectScale[1].toFixed(2)}`}
          min={0.05}
          max={10}
          step={0.05}
          value={objectScale[1]}
          onChange={(value) => updateScaleAxis(1, value)}
          marginBottom={6}
        />

        <RangeControl
          label={`Z: ${objectScale[2].toFixed(2)}`}
          min={0.05}
          max={10}
          step={0.05}
          value={objectScale[2]}
          onChange={(value) => updateScaleAxis(2, value)}
          marginBottom={0}
        />
      </DetailToggle>

      <DetailToggle
        title={lang === 'ru' ? 'Детали материала' : 'Material details'}
        open={materialOpen}
        onToggle={() => setMaterialOpen((previous) => !previous)}
      >
        <RangeControl
          label={
            lang === 'ru'
              ? `Сила блика: ${objectSpecular.toFixed(2)}`
              : `Specular strength: ${objectSpecular.toFixed(2)}`
          }
          help={lang === 'ru' ? 'Насколько ярко материал отражает источник света.' : 'How strongly the material reflects direct light.'}
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
          help={lang === 'ru' ? 'Высокая шероховатость делает блик мягче и шире.' : 'Higher roughness makes highlights softer and wider.'}
          min={0.02}
          max={1}
          step={0.02}
          value={objectRoughness}
          onChange={onObjectRoughnessChange}
          marginBottom={6}
        />

        <RangeControl
          label={lang === 'ru' ? `Shininess: ${objectShininess.toFixed(0)}` : `Legacy shininess: ${objectShininess.toFixed(0)}`}
          help={lang === 'ru' ? 'Совместимый параметр резкости блика для старой модели освещения.' : 'Compatibility highlight sharpness value for the legacy lighting model.'}
          min={4}
          max={128}
          step={1}
          value={objectShininess}
          onChange={onObjectShininessChange}
          marginBottom={6}
        />
      </DetailToggle>

      <DetailToggle
        title={lang === 'ru' ? 'Движение и тени' : 'Motion & shadows'}
        open={motionOpen}
        onToggle={() => setMotionOpen((previous) => !previous)}
      >
        <RangeControl
          label={lang === 'ru' ? `Скорость объекта: ${objectMoveSpeed.toFixed(2)}` : `Object speed: ${objectMoveSpeed.toFixed(2)}`}
          help={lang === 'ru' ? 'Скорость перемещения выбранного объекта или света с клавиатуры.' : 'Keyboard movement speed for the selected object or light.'}
          min="0.2"
          max="3.0"
          step="0.1"
          value={objectMoveSpeed}
          onChange={onObjectMoveSpeedChange}
          marginBottom={8}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4 }}>
          <input
            type="checkbox"
            checked={objectCastShadows}
            onChange={(event) => onObjectCastShadowsChange(event.target.checked)}
          />
          {lang === 'ru' ? 'Кидать тени' : 'Cast shadows'}
          <HelpMark text={lang === 'ru' ? 'Объект будет попадать в shadow map и отбрасывать тень.' : 'Object is written into shadow maps and casts a shadow.'} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4 }}>
          <input
            type="checkbox"
            checked={objectReceiveShadows}
            onChange={(event) => onObjectReceiveShadowsChange(event.target.checked)}
          />
          {lang === 'ru' ? 'Принимать тени на объект' : 'Receive shadows on object'}
          <HelpMark text={lang === 'ru' ? 'Позволяет другим объектам затемнять поверхность активного объекта.' : 'Allows other objects to darken the active object surface.'} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={objectSelfShadows}
            onChange={(event) => onObjectSelfShadowsChange(event.target.checked)}
          />
          {lang === 'ru' ? 'Самозатенение объекта' : 'Object self shadows'}
          <HelpMark text={lang === 'ru' ? 'Объект может затенять собственные поверхности.' : 'The object can shadow its own surfaces.'} />
        </label>
      </DetailToggle>
    </PanelSection>
  );
}
