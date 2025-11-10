import { useState } from 'react';

type Props = {
    onParamsChange: (params: ShadowParams) => void;
    fps?: number;
};

export type ShadowParams = {
    shadowMapSize: number;
    bias: number;
    method: 'SM' | 'PCF' | 'PCSS' | 'VSM';
    pcfRadius?: number;
    pcfSamples?: number;
    pcssLightSize?: number;
    pcssBlockerSearchSamples?: number;
    vsmMinVariance?: number;
    vsmLightBleedReduction?: number;
};

export function ControlPanel({ onParamsChange, fps = 0 }: Props) {
    const [params, setParams] = useState<ShadowParams>({
        shadowMapSize: 2048,
        bias: 0.005,
        method: 'SM',
        pcfRadius: 2.0,
        pcfSamples: 16,
        pcssLightSize: 0.05,
        pcssBlockerSearchSamples: 16,
        vsmMinVariance: 0.00001,
        vsmLightBleedReduction: 0.3
    });

    const update = (partial: Partial<ShadowParams>) => {
        const newParams = { ...params, ...partial };
        setParams(newParams);
        onParamsChange(newParams);
    };

    const isPCF = params.method === 'PCF';
    const isPCSS = params.method === 'PCSS';
    const isVSM = params.method === 'VSM';

    return (
        <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: '#1e2127',
            padding: 16,
            borderRadius: 8,
            minWidth: 260,
            maxHeight: 'calc(100vh - 24px)',
            overflowY: 'auto',
            color: '#e6e6e6',
            fontFamily: 'monospace',
            fontSize: 13
        }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Shadow Controls</h3>

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
                    <option value="PCF">PCF</option>
                    <option value="PCSS">PCSS</option>
                    <option value="VSM">VSM</option>
                </select>
            </label>

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

            {!isVSM && (
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
            )}

            {isPCF && (
                <>
                    <label style={{ display: 'block', marginBottom: 8 }}>
                        PCF Radius: {params.pcfRadius?.toFixed(1)} texels
                        <input
                            type="range"
                            min="0.5"
                            max="5.0"
                            step="0.5"
                            value={params.pcfRadius || 2.0}
                            onChange={(e) => update({ pcfRadius: +e.target.value })}
                            style={{ width: '100%', display: 'block', marginTop: 4 }}
                        />
                    </label>

                    <label style={{ display: 'block', marginBottom: 8 }}>
                        PCF Samples: {params.pcfSamples}
                        <select
                            value={params.pcfSamples}
                            onChange={(e) => update({ pcfSamples: +e.target.value })}
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
                            <option value="8">8</option>
                            <option value="16">16</option>
                            <option value="32">32</option>
                            <option value="64">64</option>
                        </select>
                    </label>
                </>
            )}

            {isPCSS && (
                <>
                    <label style={{ display: 'block', marginBottom: 8 }}>
                        Light Size: {params.pcssLightSize?.toFixed(3)}
                        <input
                            type="range"
                            min="0.01"
                            max="0.2"
                            step="0.01"
                            value={params.pcssLightSize || 0.05}
                            onChange={(e) => update({ pcssLightSize: +e.target.value })}
                            style={{ width: '100%', display: 'block', marginTop: 4 }}
                        />
                    </label>

                    <label style={{ display: 'block', marginBottom: 8 }}>
                        Blocker Search Samples: {params.pcssBlockerSearchSamples}
                        <select
                            value={params.pcssBlockerSearchSamples}
                            onChange={(e) => update({ pcssBlockerSearchSamples: +e.target.value })}
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
                            <option value="8">8</option>
                            <option value="16">16</option>
                            <option value="32">32</option>
                        </select>
                    </label>
                </>
            )}

            {isVSM && (
                <>
                    <label style={{ display: 'block', marginBottom: 8 }}>
                        Min Variance: {params.vsmMinVariance?.toExponential(2)}
                        <input
                            type="range"
                            min="-6"
                            max="-3"
                            step="0.1"
                            value={Math.log10(params.vsmMinVariance || 0.00001)}
                            onChange={(e) => update({ vsmMinVariance: Math.pow(10, +e.target.value) })}
                            style={{ width: '100%', display: 'block', marginTop: 4 }}
                        />
                    </label>

                    <label style={{ display: 'block', marginBottom: 8 }}>
                        Light Bleed Reduction: {params.vsmLightBleedReduction?.toFixed(2)}
                        <input
                            type="range"
                            min="0.0"
                            max="0.8"
                            step="0.05"
                            value={params.vsmLightBleedReduction || 0.3}
                            onChange={(e) => update({ vsmLightBleedReduction: +e.target.value })}
                            style={{ width: '100%', display: 'block', marginTop: 4 }}
                        />
                    </label>
                </>
            )}

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #2b2f36', fontSize: 11, opacity: 0.7 }}>
                FPS: {fps}
            </div>
        </div>
    );
}
