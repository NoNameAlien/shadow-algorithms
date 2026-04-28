import type { ReactNode } from 'react';
import { sectionStyle } from './styles';

type Props = {
  children: ReactNode;
};

export function PanelSection({ children }: Props) {
  return <div style={sectionStyle}>{children}</div>;
}
