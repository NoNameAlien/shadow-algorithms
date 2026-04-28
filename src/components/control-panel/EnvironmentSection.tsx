import { RangeControl } from './FormControls';
import { PanelSection } from './PanelSection';
import { colorInputStyle } from './styles';
import type { ControlPanelStrings, Lang } from './types';

type Props = {
  lang: Lang;
  strings: ControlPanelStrings;
  objectMoveSpeed: number;
  showFloor: boolean;
  showWalls: boolean;
  floorColor: string;
  wallColor: string;
  onObjectMoveSpeedChange: (value: number) => void;
  onShowFloorChange: (value: boolean) => void;
  onShowWallsChange: (value: boolean) => void;
  onFloorColorChange: (hex: string) => void;
  onWallColorChange: (hex: string) => void;
};

export function ObjectMoveSpeedSection({ strings, objectMoveSpeed, onObjectMoveSpeedChange }: Pick<Props, 'strings' | 'objectMoveSpeed' | 'onObjectMoveSpeedChange'>) {
  return (
    <PanelSection>
      <RangeControl
        label={`${strings.objectMoveSpeed}: ${objectMoveSpeed.toFixed(2)}`}
        min="0.2"
        max="3.0"
        step="0.1"
        value={objectMoveSpeed}
        onChange={onObjectMoveSpeedChange}
        marginBottom={0}
      />
    </PanelSection>
  );
}

export function EnvironmentSection({
  lang,
  strings,
  showFloor,
  showWalls,
  floorColor,
  wallColor,
  onShowFloorChange,
  onShowWallsChange,
  onFloorColorChange,
  onWallColorChange
}: Omit<Props, 'objectMoveSpeed' | 'onObjectMoveSpeedChange'>) {
  return (
    <PanelSection>
      <div style={{ marginBottom: 6, fontSize: 13, opacity: 0.85 }}>
        {lang === 'ru' ? 'Пол и стены' : 'Floor & Walls'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showFloor}
            onChange={(event) => onShowFloorChange(event.target.checked)}
          />
          {strings.floorShow}
        </label>
        <input
          type="color"
          value={floorColor}
          onChange={(event) => onFloorColorChange(event.target.value)}
          style={colorInputStyle}
          title={strings.floorColorLabel}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showWalls}
            onChange={(event) => onShowWallsChange(event.target.checked)}
          />
          {strings.wallsShow}
        </label>
        <input
          type="color"
          value={wallColor}
          onChange={(event) => onWallColorChange(event.target.value)}
          style={colorInputStyle}
          title={strings.wallColorLabel}
        />
      </div>
    </PanelSection>
  );
}
