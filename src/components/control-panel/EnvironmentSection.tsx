import { PanelSection } from './PanelSection';
import { colorInputStyle } from './styles';
import { HelpMark, RangeControl } from './FormControls';
import type { ControlPanelStrings, Lang } from './types';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  objectMoveSpeed: number;
  showFloor: boolean;
  showWalls: boolean;
  floorSize: number;
  showGrid: boolean;
  floorColor: string;
  wallColor: string;
  onObjectMoveSpeedChange: (value: number) => void;
  onShowFloorChange: (value: boolean) => void;
  onShowWallsChange: (value: boolean) => void;
  onFloorSizeChange: (value: number) => void;
  onShowGridChange: (value: boolean) => void;
  onFloorColorChange: (hex: string) => void;
  onWallColorChange: (hex: string) => void;
};

export function EnvironmentSection({
  lang,
  strings,
  showFloor,
  showWalls,
  floorSize,
  showGrid,
  floorColor,
  wallColor,
  onShowFloorChange,
  onShowWallsChange,
  onFloorSizeChange,
  onShowGridChange,
  onFloorColorChange,
  onWallColorChange
}: Omit<Props, 'objectMoveSpeed' | 'onObjectMoveSpeedChange'>) {
  return (
    <PanelSection title={lang === 'ru' ? 'Пол и стены' : 'Floor & Walls'} defaultCollapsed>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="color"
            value={floorColor}
            onChange={(event) => onFloorColorChange(event.target.value)}
            style={colorInputStyle}
            title={strings.floorColorLabel}
          />
          <input
            type="checkbox"
            checked={showFloor}
            onChange={(event) => onShowFloorChange(event.target.checked)}
          />
          {strings.floorShow}
          <HelpMark text={lang === 'ru' ? 'Включает или скрывает плоскость пола.' : 'Shows or hides the floor plane.'} />
        </label>
      </div>

      <RangeControl
        label={lang === 'ru' ? `Размер пола: ${floorSize.toFixed(0)}` : `Floor size: ${floorSize.toFixed(0)}`}
        help={lang === 'ru' ? 'Меняет размер пола и стен; удобно для широких сцен и пресетов.' : 'Changes floor and wall size for wider scenes and presets.'}
        min={4}
        max={30}
        step={1}
        value={floorSize}
        onChange={onFloorSizeChange}
        marginBottom={6}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 6 }}>
        <input
          type="checkbox"
          checked={showGrid}
          onChange={(event) => onShowGridChange(event.target.checked)}
        />
        {lang === 'ru' ? 'Показывать сетку' : 'Show grid'}
        <HelpMark text={lang === 'ru' ? 'Отключает только линии сетки, сам пол остается видимым.' : 'Hides only grid lines while keeping the floor visible.'} />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="color"
            value={wallColor}
            onChange={(event) => onWallColorChange(event.target.value)}
            style={colorInputStyle}
            title={strings.wallColorLabel}
          />
          <input
            type="checkbox"
            checked={showWalls}
            onChange={(event) => onShowWallsChange(event.target.checked)}
          />
          {strings.wallsShow}
          <HelpMark text={lang === 'ru' ? 'Включает задние стены сцены.' : 'Shows the back walls of the scene.'} />
        </label>
      </div>
    </PanelSection>
  );
}
