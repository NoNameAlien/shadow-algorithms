import { colorInputStyle } from './styles';
import type { Lang, MeshOption } from './types';
import { RangeControl, SelectControl } from './FormControls';
import { PanelSection } from './PanelSection';

type Props = {
  lang: Lang;
  objectColor: string;
  meshOptions: MeshOption[];
  activeMeshId: number;
  objectSpecular: number;
  objectShininess: number;
  objectCastShadows: boolean;
  objectReceiveShadows: boolean;
  onObjectColorChange: (hex: string) => void;
  onObjectMeshChange: (meshId: number) => void;
  onObjectSpecularChange: (value: number) => void;
  onObjectShininessChange: (value: number) => void;
  onObjectCastShadowsChange: (value: boolean) => void;
  onObjectReceiveShadowsChange: (value: boolean) => void;
};

export function ObjectParamsSection({
  lang,
  objectColor,
  meshOptions,
  activeMeshId,
  objectSpecular,
  objectShininess,
  objectCastShadows,
  objectReceiveShadows,
  onObjectColorChange,
  onObjectMeshChange,
  onObjectSpecularChange,
  onObjectShininessChange,
  onObjectCastShadowsChange,
  onObjectReceiveShadowsChange
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
            ? `Гладкость (shininess): ${objectShininess.toFixed(0)}`
            : `Shininess: ${objectShininess.toFixed(0)}`
        }
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={objectReceiveShadows}
          onChange={(event) => onObjectReceiveShadowsChange(event.target.checked)}
        />
        {lang === 'ru' ? 'Принимать тени' : 'Receive shadows'}
      </label>
    </PanelSection>
  );
}
