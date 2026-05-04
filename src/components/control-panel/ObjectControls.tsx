import { EntitySelector } from './EntitySelector';
import { ObjectMoveSpeedSection } from './EnvironmentSection';
import { ObjectParamsSection } from './ObjectParamsSection';
import type { ControlPanelProps, ControlPanelStrings, Lang } from './types';

type Props = Pick<
  ControlPanelProps,
  | 'objectCount'
  | 'activeObjectIndex'
  | 'onSelectObject'
  | 'onAddObject'
  | 'onRemoveObject'
  | 'objectColor'
  | 'onObjectColorChange'
  | 'objectCastShadows'
  | 'onObjectCastShadowsChange'
  | 'objectReceiveShadows'
  | 'onObjectReceiveShadowsChange'
  | 'objectSelfShadows'
  | 'onObjectSelfShadowsChange'
  | 'meshOptions'
  | 'activeMeshId'
  | 'onObjectMeshChange'
  | 'objectSpecular'
  | 'onObjectSpecularChange'
  | 'objectShininess'
  | 'onObjectShininessChange'
  | 'objectRoughness'
  | 'onObjectRoughnessChange'
  | 'objectMoveSpeed'
  | 'onObjectMoveSpeedChange'
> & {
  lang: Lang;
  strings: ControlPanelStrings;
};

export function ObjectControls({
  lang,
  strings,
  objectCount,
  activeObjectIndex,
  onSelectObject,
  onAddObject,
  onRemoveObject,
  objectColor,
  onObjectColorChange,
  objectCastShadows,
  onObjectCastShadowsChange,
  objectReceiveShadows,
  onObjectReceiveShadowsChange,
  objectSelfShadows,
  onObjectSelfShadowsChange,
  meshOptions,
  activeMeshId,
  onObjectMeshChange,
  objectSpecular,
  onObjectSpecularChange,
  objectShininess,
  onObjectShininessChange,
  objectRoughness,
  onObjectRoughnessChange,
  objectMoveSpeed,
  onObjectMoveSpeedChange
}: Props) {
  return (
    <>
      <EntitySelector
        label={strings.objectsLabel}
        prefix="O"
        count={objectCount}
        activeIndex={activeObjectIndex}
        lang={lang}
        addTitle={lang === 'ru' ? 'Добавить объект' : 'Add object'}
        removeTitle={lang === 'ru' ? 'Удалить объект (кроме первого)' : 'Remove object (except first)'}
        onSelect={onSelectObject}
        onAdd={onAddObject}
        onRemove={onRemoveObject}
      />

      <ObjectParamsSection
        lang={lang}
        objectColor={objectColor}
        meshOptions={meshOptions}
        activeMeshId={activeMeshId}
        objectSpecular={objectSpecular}
        objectShininess={objectShininess}
        objectRoughness={objectRoughness}
        objectCastShadows={objectCastShadows}
        objectReceiveShadows={objectReceiveShadows}
        objectSelfShadows={objectSelfShadows}
        onObjectColorChange={onObjectColorChange}
        onObjectMeshChange={onObjectMeshChange}
        onObjectSpecularChange={onObjectSpecularChange}
        onObjectShininessChange={onObjectShininessChange}
        onObjectRoughnessChange={onObjectRoughnessChange}
        onObjectCastShadowsChange={onObjectCastShadowsChange}
        onObjectReceiveShadowsChange={onObjectReceiveShadowsChange}
        onObjectSelfShadowsChange={onObjectSelfShadowsChange}
      />

      <ObjectMoveSpeedSection
        strings={strings}
        objectMoveSpeed={objectMoveSpeed}
        onObjectMoveSpeedChange={onObjectMoveSpeedChange}
      />
    </>
  );
}
