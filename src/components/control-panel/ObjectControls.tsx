import { EntitySelector } from './EntitySelector';
import { ObjectParamsSection } from './ObjectParamsSection';
import type { ControlPanelProps, ControlPanelStrings, Lang } from './types';

type Props = Pick<
  ControlPanelProps,
  | 'objectCount'
  | 'activeObjectIndex'
  | 'objectNames'
  | 'onSelectObject'
  | 'onAddObject'
  | 'onRemoveObject'
  | 'onRenameObject'
  | 'objectColor'
  | 'onObjectColorChange'
  | 'objectScale'
  | 'onObjectScaleChange'
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
  objectNames,
  onSelectObject,
  onAddObject,
  onRemoveObject,
  onRenameObject,
  objectColor,
  onObjectColorChange,
  objectScale,
  onObjectScaleChange,
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
        names={objectNames}
        lang={lang}
        addTitle={lang === 'ru' ? 'Добавить объект' : 'Add object'}
        removeTitle={lang === 'ru' ? 'Удалить объект (кроме первого)' : 'Remove object (except first)'}
        onSelect={onSelectObject}
        onAdd={onAddObject}
        onRemove={onRemoveObject}
        onRename={onRenameObject}
      />

      <ObjectParamsSection
        lang={lang}
        objectColor={objectColor}
        objectScale={objectScale}
        meshOptions={meshOptions}
        activeMeshId={activeMeshId}
        objectSpecular={objectSpecular}
        objectShininess={objectShininess}
        objectRoughness={objectRoughness}
        objectMoveSpeed={objectMoveSpeed}
        objectCastShadows={objectCastShadows}
        objectReceiveShadows={objectReceiveShadows}
        objectSelfShadows={objectSelfShadows}
        onObjectColorChange={onObjectColorChange}
        onObjectScaleChange={onObjectScaleChange}
        onObjectMeshChange={onObjectMeshChange}
        onObjectSpecularChange={onObjectSpecularChange}
        onObjectShininessChange={onObjectShininessChange}
        onObjectRoughnessChange={onObjectRoughnessChange}
        onObjectMoveSpeedChange={onObjectMoveSpeedChange}
        onObjectCastShadowsChange={onObjectCastShadowsChange}
        onObjectReceiveShadowsChange={onObjectReceiveShadowsChange}
        onObjectSelfShadowsChange={onObjectSelfShadowsChange}
      />

    </>
  );
}
