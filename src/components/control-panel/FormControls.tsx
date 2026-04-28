import type { ChangeEvent } from 'react';
import { selectStyle } from './styles';

type RangeControlProps = {
  label: string;
  min: number | string;
  max: number | string;
  step: number | string;
  value: number;
  onChange: (value: number) => void;
  marginBottom?: number;
};

export function RangeControl({ label, min, max, step, value, onChange, marginBottom = 8 }: RangeControlProps) {
  return (
    <label style={{ display: 'block', marginBottom }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', display: 'block', marginTop: 4 }}
      />
    </label>
  );
}

type SelectControlProps<T extends string | number> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  marginBottom?: number;
};

export function SelectControl<T extends string | number>({
  label,
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
      <span style={{ fontSize: 13 }}>{label}</span>
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
