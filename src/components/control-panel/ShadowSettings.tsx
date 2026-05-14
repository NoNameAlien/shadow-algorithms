import { ShadowSettingsSection } from './ShadowSettingsSection';
import type { ControlPanelStrings, ShadowParams } from './types';

type Props = {
  params: ShadowParams;
  strings: ControlPanelStrings;
  onUpdate: (partial: Partial<ShadowParams>) => void;
  mode?: 'all' | 'scene' | 'debug';
};

export function ShadowSettings(props: Props) {
  return <ShadowSettingsSection {...props} />;
}
