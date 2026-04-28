import type { Lang } from './types';
import { buttonStyle } from './styles';
import { PanelSection } from './PanelSection';

type Props = {
  label: string;
  prefix: string;
  count: number;
  activeIndex: number;
  lang: Lang;
  addTitle: string;
  removeTitle: string;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: () => void;
};

export function EntitySelector({
  label,
  prefix,
  count,
  activeIndex,
  lang,
  addTitle,
  removeTitle,
  onSelect,
  onAdd,
  onRemove
}: Props) {
  return (
    <PanelSection>
      <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.85 }}>
        {label} ({count})
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            style={{
              ...buttonStyle,
              minWidth: 32,
              background: activeIndex === index ? '#3b5bdb' : '#252a34'
            }}
          >
            {prefix}
            {index + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={onAdd}
          style={{ ...buttonStyle, background: '#2f9e44' }}
          title={addTitle}
        >
          +
        </button>
        <button
          type="button"
          onClick={onRemove}
          style={{
            ...buttonStyle,
            background: count > 1 ? '#c92a2a' : '#3b3b3b',
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
