import type { ControlPanelStrings, Lang } from './types';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  showHints: boolean;
  isPointerLocked: boolean;
  fps: number;
  onToggleHints: () => void;
};

export function HintsSection({ lang, strings, showHints, isPointerLocked, fps, onToggleHints }: Props) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleHints}
        style={{
          width: '100%',
          padding: 6,
          marginBottom: 6,
          background: '#202531',
          color: '#e6e6e6',
          border: '1px solid #343b4a',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13
        }}
      >
        {showHints
          ? lang === 'ru'
            ? 'Спрятать подсказки'
            : 'Hide tips'
          : lang === 'ru'
            ? 'Показать подсказки'
            : 'Show tips'}
      </button>

      {showHints && (
        <div
          style={{
            marginTop: 4,
            paddingTop: 8,
            borderTop: '1px solid #262a32',
            fontSize: 13,
            opacity: 0.8,
            lineHeight: 1.5
          }}
        >
          {isPointerLocked ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{strings.fpsMode}</div>
              <div>WASD / стрелки — движение камеры</div>
              <div>Space / Shift — вверх / вниз</div>
              <div>Мышь — обзор</div>
              <div>ESC — выход из FPS режима</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{strings.orbitMode}</div>
              <div>ЛКМ по объекту — вращение</div>
              <div>ЛКМ по объекту + оси — перемещение по осям</div>
              <div>ЛКМ по источнику — выбор света</div>
              <div>ЛКМ по оси возле света — движение источника</div>
              <div>ЛКМ по свету (Spot) мимо осей — поворот прожектора</div>
              <div>Колёсико мыши — зум</div>
              <div style={{ marginTop: 4 }}>Ctrl+клик по холсту — вход в FPS режим</div>
            </>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: '1px solid #262a32',
          fontSize: 13,
          opacity: 0.7,
          textAlign: 'right'
        }}
      >
        {strings.fpsLabel}: {Math.min(120, fps)}
      </div>
    </>
  );
}
