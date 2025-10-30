import { useState } from 'react';

type Props = {
    onParamsChange: (params: ShadowParams) => void;
};

export type ShadowParams = {
    shadowMapSize: number;
    bias: number;
    method: 'SM' | 'PCF' | 'PCSS' | 'VSM';
};

export function ControlPanel({ onParamsChange }: Props) {
    const [params, setParams] = useState<ShadowParams>({
        shadowMapSize: 2048,
        bias: 0.005,
        method: 'SM'
    });

    const update = (partial: Partial<ShadowParams>) => {
        const newParams = { ...params, ...partial };
        setParams(newParams);
        onParamsChange(newParams);
    };

    return (
        <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: '#1e2127',
            padding: 16,
            borderRadius: 8,
            minWidth: 240,
            color: '#e6e6e6',
            fontFamily: 'monospace',
            fontSize: 13
        }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Shadow Controls</h3>

            <label style={{ display: 'block', marginBottom: 8 }}>
                Shadow Map Size: {params.shadowMapSize}
                <input
                    type="range"
                    min="512"
                    max="4096"
                    step="512"
                    value={params.shadowMapSize}
                    onChange={(e) => update({ shadowMapSize: +e.target.value })}
                    style={{ width: '100%', display: 'block', marginTop: 4 }}
                />
            </label>

            <label style={{ display: 'block', marginBottom: 8 }}>
                Bias: {params.bias.toFixed(4)}
                <input
                    type="range"
                    min="0.001"
                    max="0.02"
                    step="0.001"
                    value={params.bias}
                    onChange={(e) => update({ bias: +e.target.value })}
                    style={{ width: '100%', display: 'block', marginTop: 4 }}
                />
            </label>

            <label style={{ display: 'block', marginBottom: 8 }}>
                Method:
                <select
                    value={params.method}
                    onChange={(e) => update({ method: e.target.value as any })}
                    style={{
                        width: '100%',
                        display: 'block',
                        marginTop: 4,
                        padding: 4,
                        background: '#2b2f36',
                        color: '#e6e6e6',
                        border: 'none',
                        borderRadius: 4
                    }}
                >
                    <option value="SM">Shadow Mapping</option>
                    <option value="PCF">PCF (скоро)</option>
                    <option value="PCSS">PCSS (скоро)</option>
                    <option value="VSM">VSM (скоро)</option>
                </select>
            </label>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #2b2f36', fontSize: 11, opacity: 0.7 }}>
                FPS: 60 (soon)
            </div>
        </div>
    );
}
