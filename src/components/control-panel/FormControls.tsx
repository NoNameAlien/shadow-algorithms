import type { ChangeEvent } from 'react';
import { selectStyle } from './styles';

type RangeControlProps = {
  label: string;
  help?: string;
  min: number | string;
  max: number | string;
  step: number | string;
  value: number;
  onChange: (value: number) => void;
  marginBottom?: number;
};

export function HelpMark({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 14,
        height: 14,
        marginLeft: 5,
        border: '1px solid rgba(214, 221, 235, 0.36)',
        borderRadius: '50%',
        color: 'rgba(230, 230, 230, 0.62)',
        fontSize: 10,
        lineHeight: 1,
        cursor: 'help'
      }}
    >
      ?
    </span>
  );
}

export function RangeControl({ label, help, min, max, step, value, onChange, marginBottom = 8 }: RangeControlProps) {
  return (
    <label style={{ display: 'block', marginBottom }}>
      <span style={{ fontSize: 13, lineHeight: 1.25, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{label}</span>
        {help ? <HelpMark text={help} /> : null}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', display: 'block', marginTop: 4, accentColor: '#4c6ef5' }}
      />
    </label>
  );
}

type SelectControlProps<T extends string | number> = {
  label: string;
  help?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  marginBottom?: number;
};

export function SelectControl<T extends string | number>({
  label,
  help,
  value,
  options,
  onChange,
  marginBottom = 8
}: SelectControlProps<T>) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = options.find((option) => String(option.value) === event.target.value);
    if (selected) onChange(selected.value);
  };

  return (
    <label style={{ display: 'block', marginBottom }}>
      <span style={{ fontSize: 13, lineHeight: 1.25, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{label}</span>
        {help ? <HelpMark text={help} /> : null}
      </span>
      <select value={value} onChange={handleChange} style={selectStyle}>
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
