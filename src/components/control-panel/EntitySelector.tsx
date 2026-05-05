import { useEffect, useRef, useState } from 'react';
import type { Lang } from './types';
import { buttonStyle, dangerButtonStyle, primaryButtonStyle } from './styles';
import { PanelSection } from './PanelSection';

type Props = {
  label: string;
  prefix: string;
  count: number;
  activeIndex: number;
  names: string[];
  lang: Lang;
  addTitle: string;
  removeTitle: string;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onRename: (index: number, name: string) => void;
};

export function EntitySelector({
  label,
  prefix,
  count,
  activeIndex,
  names,
  lang,
  addTitle,
  removeTitle,
  onSelect,
  onAdd,
  onRemove,
  onRename
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const cancelEditRef = useRef(false);

  useEffect(() => {
    if (editingIndex === null) return;
    setDraftName(names[editingIndex] || `${prefix}${editingIndex + 1}`);
  }, [editingIndex, names, prefix]);

  const commitRename = () => {
    if (editingIndex === null) return;
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      setEditingIndex(null);
      return;
    }
    onRename(editingIndex, draftName);
    setEditingIndex(null);
  };

  return (
    <PanelSection title={`${label} (${count})`} collapsible={false}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {Array.from({ length: count }, (_, index) => (
          editingIndex === index ? (
            <input
              key={index}
              data-allow-key-activation="true"
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitRename();
                if (event.key === 'Escape') {
                  cancelEditRef.current = true;
                  setEditingIndex(null);
                }
              }}
              style={{
                minWidth: 72,
                maxWidth: 140,
                padding: '3px 6px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #4c6ef5',
                background: '#252a34',
                color: '#e6e6e6'
              }}
            />
          ) : (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              onDoubleClick={() => {
                onSelect(index);
                cancelEditRef.current = false;
                setEditingIndex(index);
              }}
              title={names[index] || `${prefix}${index + 1}`}
              style={{
                ...buttonStyle,
                maxWidth: 140,
                minWidth: 32,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                background: activeIndex === index ? '#3b5bdb' : '#252a34'
              }}
            >
              {names[index] || `${prefix}${index + 1}`}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={onAdd}
          style={{ ...primaryButtonStyle }}
          title={addTitle}
        >
          +
        </button>
        <button
          type="button"
          onClick={onRemove}
          style={{
            ...buttonStyle,
            ...(count > 1 ? dangerButtonStyle : { background: '#3b3b3b' }),
            cursor: count > 1 ? 'pointer' : 'not-allowed',
            opacity: count > 1 ? 1 : 0.6
          }}
          title={removeTitle}
          aria-label={lang === 'ru' ? 'Удалить' : 'Remove'}
        >
          −
        </button>
      </div>
    </PanelSection>
  );
}
