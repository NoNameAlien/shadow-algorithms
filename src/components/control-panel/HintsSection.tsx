import { useState } from 'react';
import type { ControlPanelStrings, Lang } from './types';
import { subtleButtonStyle } from './styles';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  isPointerLocked: boolean;
};

export function HintsSection({ lang, strings, isPointerLocked }: Props) {
  const [open, setOpen] = useState(false);
  const title = lang === 'ru' ? 'Подсказки управления' : 'Control tips';

  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        style={{
          ...subtleButtonStyle,
          width: '100%',
          padding: '7px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        title={title}
      >
        <span>{title}</span>
        <span style={{ opacity: 0.68 }}>?</span>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 38,
            zIndex: 10,
            width: 316,
            padding: 10,
            background: '#1e222b',
            border: '1px solid #343b4a',
            borderRadius: 6,
            boxShadow: '0 12px 30px rgba(0,0,0,0.36)',
            fontSize: 13,
            lineHeight: 1.45
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong>{title}</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ ...subtleButtonStyle, width: 24, height: 24, padding: 0 }}
              aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
            >
              ×
            </button>
          </div>
          {isPointerLocked ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{strings.fpsMode}</div>
              <div>{lang === 'ru' ? 'WASD / стрелки - движение камеры' : 'WASD / arrows - move camera'}</div>
              <div>{lang === 'ru' ? 'Space / Shift - вверх / вниз' : 'Space / Shift - up / down'}</div>
              <div>{lang === 'ru' ? 'Мышь - обзор' : 'Mouse - look around'}</div>
              <div>{lang === 'ru' ? 'ESC - выход из FPS режима' : 'ESC - exit FPS mode'}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{strings.orbitMode}</div>
              <div>{lang === 'ru' ? 'ЛКМ по объекту - выбор объекта' : 'Click object - select object'}</div>
              <div>{lang === 'ru' ? 'ЛКМ по пустому месту - снять фокус' : 'Click empty space - clear focus'}</div>
              <div>{lang === 'ru' ? 'Стрелки / Space / Shift - перемещение выбранного объекта или света' : 'Arrows / Space / Shift - move selected object or light'}</div>
              <div>{lang === 'ru' ? 'ЛКМ по оси - перемещение по оси' : 'Click axis - move along axis'}</div>
              <div>{lang === 'ru' ? 'ЛКМ по источнику - выбор света' : 'Click light - select light'}</div>
              <div>{lang === 'ru' ? 'ЛКМ по Spot-свету мимо осей - поворот прожектора' : 'Click selected Spot away from axes - rotate spotlight'}</div>
              <div>{lang === 'ru' ? 'Колесо мыши - зум' : 'Mouse wheel - zoom'}</div>
              <div>{lang === 'ru' ? 'Двойной клик в списке - переименовать' : 'Double-click list item - rename'}</div>
              <div style={{ marginTop: 4 }}>{lang === 'ru' ? 'Ctrl+клик по холсту - вход в FPS режим' : 'Ctrl+click canvas - enter FPS mode'}</div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
