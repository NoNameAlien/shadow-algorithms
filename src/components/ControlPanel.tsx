import { useState, useRef } from 'react';

type Props = {
    onParamsChange: (params: ShadowParams) => void;
    onLoadModel: (file: File) => void;
    onResetScene?: () => void;
    onResetModel?: () => void;
    fps?: number;
    isPointerLocked?: boolean;
    lightMode: 'sun' | 'spot' | 'top';
    onLightModeChange: (mode: 'sun' | 'spot' | 'top') => void;
    onLoadObjectTexture?: (file: File) => void;
    onLoadFloorTexture?: (file: File) => void;
    lang: 'en' | 'ru';
    onLanguageChange: (lang: 'en' | 'ru') => void;
    autoRotate: boolean;
    onToggleAutoRotate: () => void;
    showFloor: boolean;
    showWalls: boolean;
    floorColor: string;
    wallColor: string;
    onShowFloorChange: (value: boolean) => void;
    onShowWallsChange: (value: boolean) => void;
    onFloorColorChange: (hex: string) => void;
    onWallColorChange: (hex: string) => void;
    objectMoveSpeed: number;
    onObjectMoveSpeedChange: (value: number) => void;
    lightIntensity: number;
    onLightIntensityChange: (value: number) => void;
    showLightBeam: boolean;
    onShowLightBeamChange: (value: boolean) => void;
};

const INITIAL_PARAMS: ShadowParams = {
    shadowMapSize: 2048,
    bias: 0.003,
    method: 'SM',
    pcfRadius: 2.5,
    pcfSamples: 8,
    pcssLightSize: 0.08,
    pcssBlockerSearchSamples: 8,
    vsmMinVariance: 0.0001,
    vsmLightBleedReduction: 0.4,
    shadowStrength: 1.0
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
    shadowStrength?: number;
};

const STRINGS = {
    en: {
        title: 'Shadow Controls',
        methodLabel: 'Method:',
        lightModeLabel: 'Light Mode',
        shadowMapSize: 'Shadow Map Size',
        bias: 'Bias',
        pcfRadius: 'PCF Radius',
        pcfSamples: 'PCF Samples',
        pcssLightSize: 'Light Size',
        pcssBlockerSamples: 'Blocker Search Samples',
        vsmMinVariance: 'Min Variance',
        vsmLightBleed: 'Light Bleed Reduction',
        shadowStrength: 'Shadow Strength',
        resetScene: 'Reset Scene',
        objectTexture: 'Object Texture:',
        floorTexture: 'Floor Texture:',
        loadModel: 'Load Model (OBJ):',
        chooseObj: 'Choose',
        noModel: 'No model loaded',
        removeModel: 'Remove model',
        orbitMode: 'ORBIT MODE (default)',
        fpsMode: 'FPS MODE (ESC to exit)',
        fpsLabel: 'FPS',
        floorShow: 'Show floor',
        wallsShow: 'Show walls',
        floorColorLabel: 'Floor color',
        wallColorLabel: 'Wall color',
        objectMoveSpeed: 'Object move speed',
        lightIntensity: 'Light intensity',
        lightBeamShow: 'Show light beam',
    },
    ru: {
        title: 'Настройки теней',
        methodLabel: 'Метод:',
        lightModeLabel: 'Тип света',
        shadowMapSize: 'Размер карты теней',
        bias: 'Смещение (bias)',
        pcfRadius: 'Радиус PCF',
        pcfSamples: 'Сэмплы PCF',
        pcssLightSize: 'Размер источника',
        pcssBlockerSamples: 'Сэмплы поиска блокеров',
        vsmMinVariance: 'Мин. дисперсия',
        vsmLightBleed: 'Подавление протекания света',
        shadowStrength: 'Сила теней',
        resetScene: 'Сброс сцены',
        objectTexture: 'Текстура объекта:',
        floorTexture: 'Текстура пола:',
        loadModel: 'Модель (OBJ):',
        chooseObj: 'Выбрать',
        noModel: 'Модель не загружена',
        removeModel: 'Убрать модель',
        orbitMode: 'ОРБИТАЛЬНЫЙ РЕЖИМ (по умолчанию)',
        fpsMode: 'РЕЖИМ FPS (ESC для выхода)',
        fpsLabel: 'FPS',
        floorShow: 'Показывать пол',
        wallsShow: 'Показывать стены',
        floorColorLabel: 'Цвет пола',
        wallColorLabel: 'Цвет стен',
        objectMoveSpeed: 'Скорость перемещения объекта',
        lightIntensity: 'Яркость света',
        lightBeamShow: 'Показывать луч источника',
    }
} as const;

export function ControlPanel({
    onParamsChange,
    onLoadModel,
    onResetScene,
    onResetModel,
    onLoadObjectTexture,
    onLoadFloorTexture,
    fps = 0,
    isPointerLocked = false,
    lightMode,
    onLightModeChange,
    lang,
    onLanguageChange,
    autoRotate,
    onToggleAutoRotate,
    showFloor,
    showWalls,
    floorColor,
    wallColor,
    onShowFloorChange,
    onShowWallsChange,
    onFloorColorChange,
    onWallColorChange,
    objectMoveSpeed,
    onObjectMoveSpeedChange,
    lightIntensity,
    onLightIntensityChange,
    showLightBeam,
    onShowLightBeamChange
}: Props) {
    const [params, setParams] = useState<ShadowParams>(INITIAL_PARAMS);
    const [modelName, setModelName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const objTexInputRef = useRef<HTMLInputElement | null>(null);
    const floorTexInputRef = useRef<HTMLInputElement | null>(null);
    const [showHints, setShowHints] = useState(false);
    const t = STRINGS[lang];

    const update = (partial: Partial<ShadowParams>) => {
        const newParams = { ...params, ...partial };
        setParams(newParams);
        onParamsChange(newParams);
    };

    const isPCF = params.method === 'PCF';
    const isPCSS = params.method === 'PCSS';
    const isVSM = params.method === 'VSM';

    return (
        <div
            style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: '#181b20',
                padding: 14,
                borderRadius: 10,
                minWidth: 280,
                maxWidth: 340,
                maxHeight: 'calc(100vh - 24px)',
                overflowY: 'auto',
                color: '#e6e6e6',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: 14,
                boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                border: '1px solid #262a32'
            }}
        >
            {/* Шапка: заголовок + метод + язык */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10
                }}
            >
                <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{t.title}</div>
                    <div
                        style={{
                            marginTop: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: '#202531',
                            fontSize: 13,
                            color: '#ccd0ff'
                        }}
                    >
                        {t.methodLabel}{' '}
                        <span style={{ fontWeight: 600, marginLeft: 4 }}>{params.method}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {/* Кнопка паузы авто‑вращения */}
                    <button
                        type="button"
                        onClick={onToggleAutoRotate}
                        style={{
                            padding: '3px 8px',
                            fontSize: 13,
                            borderRadius: 999,
                            border: '1px solid #333948',
                            background: autoRotate ? '#202531' : '#2f9e44',
                            color: '#e6e6e6',
                            cursor: 'pointer'
                        }}
                        title={
                            lang === 'ru'
                                ? (autoRotate ? 'Поставить вращение на паузу' : 'Возобновить вращение объекта')
                                : (autoRotate ? 'Pause object rotation' : 'Resume object rotation')
                        }
                    >
                        {autoRotate ? '⏸' : '▶'}
                    </button>

                    <button
                        type="button"
                        onClick={() => onLanguageChange('en')}
                        style={{
                            padding: '3px 8px',
                            fontSize: 13,
                            borderRadius: 999,
                            border: '1px solid #333948',
                            background: lang === 'en' ? '#3b5bdb' : '#202531',
                            color: '#e6e6e6',
                            cursor: 'pointer'
                        }}
                    >
                        EN
                    </button>
                    <button
                        type="button"
                        onClick={() => onLanguageChange('ru')}
                        style={{
                            padding: '3px 8px',
                            fontSize: 13,
                            borderRadius: 999,
                            border: '1px solid #333948',
                            background: lang === 'ru' ? '#3b5bdb' : '#202531',
                            color: '#e6e6e6',
                            cursor: 'pointer'
                        }}
                    >
                        RU
                    </button>
                </div>
            </div>

            {/* Блок: тип света */}
            <div
                style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#1e222b',
                    border: '1px solid #262a32',
                    marginBottom: 10
                }}
            >
                <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.85 }}>
                    {t.lightModeLabel}:{' '}
                    <span style={{ fontWeight: 600 }}>{lightMode.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {(['sun', 'spot', 'top'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => onLightModeChange(mode)}
                            style={{
                                flex: 1,
                                padding: '4px 6px',
                                fontSize: 13,
                                borderRadius: 6,
                                border: '1px solid #343b4a',
                                background: lightMode === mode ? '#3b5bdb' : '#252a34',
                                color: '#e6e6e6',
                                cursor: 'pointer'
                            }}
                        >
                            {mode.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Блок: интенсивность света */}
            <div
                style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#1e222b',
                    border: '1px solid #262a32',
                    marginBottom: 10
                }}
            >
                <label style={{ display: 'block', marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>
                        {t.lightIntensity}: {lightIntensity.toFixed(2)}
                    </span>
                    <input
                        type="range"
                        min="0.0"
                        max="3.0"
                        step="0.1"
                        value={lightIntensity}
                        onChange={(e) => onLightIntensityChange(+e.target.value)}
                        style={{ width: '100%', display: 'block', marginTop: 4 }}
                    />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input
                        type="checkbox"
                        checked={showLightBeam}
                        onChange={(e) => onShowLightBeamChange(e.target.checked)}
                    />
                    {t.lightBeamShow}
                </label>
            </div>

            {/* Блок: метод теней + параметры */}
            <div
                style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#1e222b',
                    border: '1px solid #262a32',
                    marginBottom: 10
                }}
            >
                <label style={{ display: 'block', marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>{t.methodLabel}</span>
                    <select
                        value={params.method}
                        onChange={(e) => update({ method: e.target.value as any })}
                        style={{
                            width: '100%',
                            display: 'block',
                            marginTop: 4,
                            padding: 4,
                            background: '#252a34',
                            color: '#e6e6e6',
                            border: '1px solid #343b4a',
                            borderRadius: 4,
                            fontSize: 14
                        }}
                    >
                        <option value="SM">Shadow Mapping</option>
                        <option value="PCF">PCF</option>
                        <option value="PCSS">PCSS</option>
                        <option value="VSM">VSM</option>
                    </select>
                </label>

                <label style={{ display: 'block', marginBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>{t.shadowMapSize}: {params.shadowMapSize}</span>
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
                        <span style={{ fontSize: 13 }}>{t.bias}: {params.bias.toFixed(4)}</span>
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
                            <span style={{ fontSize: 13 }}>
                                {t.pcfRadius}: {params.pcfRadius?.toFixed(1)} texels
                            </span>
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
                            <span style={{ fontSize: 13 }}>
                                {t.pcfSamples}: {params.pcfSamples}
                            </span>
                            <select
                                value={params.pcfSamples}
                                onChange={(e) => update({ pcfSamples: +e.target.value })}
                                style={{
                                    width: '100%',
                                    display: 'block',
                                    marginTop: 4,
                                    padding: 4,
                                    background: '#252a34',
                                    color: '#e6e6e6',
                                    border: '1px solid #343b4a',
                                    borderRadius: 4,
                                    fontSize: 14
                                }}
                            >
                                <option value="4">4</option>
                                <option value="8">8</option>
                                <option value="16">16</option>
                                <option value="32">32</option>
                            </select>
                        </label>
                    </>
                )}

                {isPCSS && (
                    <>
                        <label style={{ display: 'block', marginBottom: 8 }}>
                            <span style={{ fontSize: 13 }}>
                                {t.pcssLightSize}: {params.pcssLightSize?.toFixed(3)}
                            </span>
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

                        <label style={{ display: 'block', marginBottom: 0 }}>
                            <span style={{ fontSize: 13 }}>
                                {t.pcssBlockerSamples}: {params.pcssBlockerSearchSamples}
                            </span>
                            <select
                                value={params.pcssBlockerSearchSamples}
                                onChange={(e) => update({ pcssBlockerSearchSamples: +e.target.value })}
                                style={{
                                    width: '100%',
                                    display: 'block',
                                    marginTop: 4,
                                    padding: 4,
                                    background: '#252a34',
                                    color: '#e6e6e6',
                                    border: '1px solid #343b4a',
                                    borderRadius: 4,
                                    fontSize: 14
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
                        <label style={{ display: 'block', marginBottom: 8, marginTop: 8 }}>
                            <span style={{ fontSize: 13 }}>
                                {t.vsmMinVariance}: {params.vsmMinVariance?.toExponential(2)}
                            </span>
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

                        <label style={{ display: 'block', marginBottom: 0 }}>
                            <span style={{ fontSize: 13 }}>
                                {t.vsmLightBleed}: {params.vsmLightBleedReduction?.toFixed(2)}
                            </span>
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
            </div>

            {/* Блок: сила теней */}
            <div
                style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#1e222b',
                    border: '1px solid #262a32',
                    marginBottom: 10
                }}
            >
                <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 13 }}>
                        {t.shadowStrength} (×{(params.shadowStrength ?? 1.0).toFixed(2)})
                    </span>
                    <input
                        type="range"
                        min="0.0"
                        max="2.0"
                        step="0.05"
                        value={params.shadowStrength ?? 1.0}
                        onChange={(e) => update({ shadowStrength: +e.target.value })}
                        style={{ width: '100%', display: 'block', marginTop: 4 }}
                    />
                </label>
            </div>

            {/* Блок: скорость перемещения объекта */}
            <div
                style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#1e222b',
                    border: '1px solid #262a32',
                    marginBottom: 10
                }}
            >
                <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 13 }}>
                        {t.objectMoveSpeed}: {objectMoveSpeed.toFixed(2)}
                    </span>
                    <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={objectMoveSpeed}
                        onChange={(e) => onObjectMoveSpeedChange(+e.target.value)}
                        style={{ width: '100%', display: 'block', marginTop: 4 }}
                    />
                </label>
            </div>


            {/* Блок: пол и стены */}
            <div
                style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#1e222b',
                    border: '1px solid #262a32',
                    marginBottom: 10
                }}
            >
                <div style={{ marginBottom: 6, fontSize: 13, opacity: 0.85 }}>
                    {lang === 'ru' ? 'Пол и стены' : 'Floor & Walls'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input
                            type="checkbox"
                            checked={showFloor}
                            onChange={(e) => onShowFloorChange(e.target.checked)}
                        />
                        {t.floorShow}
                    </label>
                    <input
                        type="color"
                        value={floorColor}
                        onChange={(e) => onFloorColorChange(e.target.value)}
                        style={{ width: 32, height: 20, padding: 0, border: 'none', cursor: 'pointer' }}
                        title={t.floorColorLabel}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input
                            type="checkbox"
                            checked={showWalls}
                            onChange={(e) => onShowWallsChange(e.target.checked)}
                        />
                        {t.wallsShow}
                    </label>
                    <input
                        type="color"
                        value={wallColor}
                        onChange={(e) => onWallColorChange(e.target.value)}
                        style={{ width: 32, height: 20, padding: 0, border: 'none', cursor: 'pointer' }}
                        title={t.wallColorLabel}
                    />
                </div>
            </div>

            {/* Блок: текстуры и модель */}
            <div
                style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#1e222b',
                    border: '1px solid #262a32',
                    marginBottom: 10
                }}
            >
                {/* Текстура объекта */}
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, opacity: 0.8 }}>
                    {t.objectTexture}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button
                        type="button"
                        onClick={() => objTexInputRef.current?.click()}
                        style={{
                            padding: '4px 8px',
                            fontSize: 13,
                            background: '#252a34',
                            color: '#e6e6e6',
                            border: '1px solid #343b4a',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {t.chooseObj}
                    </button>
                    <span
                        style={{
                            flexGrow: 1,
                            fontSize: 12,
                            opacity: 0.6
                        }}
                    >
                        {lang === 'ru' ? 'Изображение для объекта' : 'Image for object'}
                    </span>
                </div>
                <input
                    ref={objTexInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onLoadObjectTexture) onLoadObjectTexture(file);
                    }}
                    style={{ display: 'none' }}
                />

                {/* Текстура пола */}
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, opacity: 0.8 }}>
                    {t.floorTexture}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button
                        type="button"
                        onClick={() => floorTexInputRef.current?.click()}
                        style={{
                            padding: '4px 8px',
                            fontSize: 13,
                            background: '#252a34',
                            color: '#e6e6e6',
                            border: '1px solid #343b4a',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {t.chooseObj}
                    </button>
                    <span
                        style={{
                            flexGrow: 1,
                            fontSize: 12,
                            opacity: 0.6
                        }}
                    >
                        {lang === 'ru' ? 'Изображение для пола' : 'Image for floor'}
                    </span>
                </div>
                <input
                    ref={floorTexInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onLoadFloorTexture) onLoadFloorTexture(file);
                    }}
                    style={{ display: 'none' }}
                />

                {/* Загрузка модели (как было) */}
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, marginTop: 4, opacity: 0.8 }}>
                    {t.loadModel}
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            padding: '4px 8px',
                            fontSize: 13,
                            background: '#252a34',
                            color: '#e6e6e6',
                            border: '1px solid #343b4a',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {t.chooseObj}
                    </button>

                    <span
                        style={{
                            flexGrow: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 13,
                            opacity: modelName ? 1 : 0.6
                        }}
                        title={modelName || t.noModel}
                    >
                        {modelName
                            ? modelName.length > 18
                                ? modelName.slice(0, 18) + '…'
                                : modelName
                            : t.noModel}
                    </span>

                    {modelName && (
                        <button
                            type="button"
                            onClick={() => {
                                setModelName(null);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                                onResetModel?.();
                            }}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#aaa',
                                cursor: 'pointer',
                                fontSize: 16,
                                padding: 0
                            }}
                            title={t.removeModel}
                        >
                            ×
                        </button>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".obj"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            setModelName(file.name);
                            onLoadModel(file);
                        }
                    }}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Кнопка Reset */}
            <button
                onClick={() => {
                    setParams(INITIAL_PARAMS);
                    onParamsChange(INITIAL_PARAMS);
                    onLightModeChange('sun');
                    if (!autoRotate) onToggleAutoRotate();

                    onShowFloorChange(true);
                    onShowWallsChange(true);
                    onFloorColorChange('#26282d');
                    onWallColorChange('#1f2226');

                    onWallColorChange('#1f2226');
                    onObjectMoveSpeedChange(1.0);
                    onLightIntensityChange(1.0);
                    onShowLightBeamChange(true);

                    onResetScene?.();
                    onResetModel?.();
                    setModelName(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{
                    width: '100%',
                    padding: 8,
                    marginBottom: 8,
                    background: '#c92a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                }}
            >
                {t.resetScene}
            </button>

            {/* Кнопка показать/скрыть подсказки */}
            <button
                type="button"
                onClick={() => setShowHints(!showHints)}
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
                    ? (lang === 'ru' ? 'Спрятать подсказки' : 'Hide tips')
                    : (lang === 'ru' ? 'Показать подсказки' : 'Show tips')}
            </button>

            {/* Подсказки (по умолчанию скрыты) */}
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
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {t.fpsMode}
                            </div>
                            <div>WASD / стрелки — движение камеры</div>
                            <div>Space / Shift — вверх / вниз</div>
                            <div>Мышь — обзор</div>
                            <div>ESC — выход из FPS режима</div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {t.orbitMode}
                            </div>
                            <div>ЛКМ по объекту — вращение</div>
                            <div>ЛКМ по объекту + оси — перемещение по осям</div>
                            <div>ЛКМ по источнику — выбор света</div>
                            <div>ЛКМ по оси возле света — движение источника</div>
                            <div>ЛКМ по свету (Spot) мимо осей — поворот прожектора</div>
                            <div>Колёсико мыши — зум</div>
                            <div style={{ marginTop: 4 }}>
                                Ctrl+клик по холсту — вход в FPS режим
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* FPS внизу */}
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
                {t.fpsLabel}: {Math.min(120, fps)}
            </div>
        </div>
    );
}
