import type { ControlPanelStrings, Lang, ShadowMethod } from './types';

type Props = {
  autoRotate: boolean;
  lang: Lang;
  method: ShadowMethod;
  strings: ControlPanelStrings;
  onLanguageChange: (lang: Lang) => void;
  onToggleAutoRotate: () => void;
};

export function Header({ autoRotate, lang, method, strings, onLanguageChange, onToggleAutoRotate }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{strings.title}</div>
        <div
          style={{
            marginTop: 4,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 6px',
            borderRadius: 999,
            background: '#202531',
            fontSize: 13,
            color: '#ccd0ff'
          }}
        >
          {strings.methodLabel} <span style={{ fontWeight: 600, marginLeft: 4 }}>{method}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onToggleAutoRotate}
          style={{
            padding: '3px 8px',
            fontSize: 13,
            borderRadius: 999,
            border: '1px solid #333948',
            background: autoRotate ? '#202531' : '#2f9e44',
            color: '#e6e6e6',
            cursor: 'pointer'
          }}
          title={
            lang === 'ru'
              ? autoRotate
                ? 'Поставить вращение на паузу'
                : 'Возобновить вращение объекта'
              : autoRotate
                ? 'Pause object rotation'
                : 'Resume object rotation'
          }
        >
          {autoRotate ? '⏸' : '▶'}
        </button>

        {(['en', 'ru'] as const).map((language) => (
          <button
            key={language}
            type="button"
            onClick={() => onLanguageChange(language)}
            style={{
              padding: '3px 8px',
              fontSize: 13,
              borderRadius: 999,
              border: '1px solid #333948',
              background: lang === language ? '#3b5bdb' : '#202531',
              color: '#e6e6e6',
              cursor: 'pointer'
            }}
          >
            {language.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
