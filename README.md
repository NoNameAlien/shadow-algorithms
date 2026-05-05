# Shadow Algorithms Lab (WebGPU)

<!-- ![Project Preview](docs/images/preview.png) -->

Интерактивная веб-лаборатория для реализации и сравнения алгоритмов построения теней в реальном времени (WebGPU + TypeScript + React).

Цель — построить одностраничную веб‑лабораторию (“калькулятор параметров”), которая реализует и сравнивает популярные алгоритмы теней: Shadow Mapping, PCF, PCSS, VSM/EVSM, а также, по времени, Cascaded Shadow Maps (CSM). Проект будет включать интерактивное управление параметрами, набор тест‑сцен, сбор метрик качества/производительности и экспорт отчётов.

## 🛠️ Технический стек

### Frontend

- **React 18** — UI компоненты
- **TypeScript 5.2** — типобезопасность
- **Vite** — быстрая сборка и HMR

### Graphics

- **WebGPU** — современный GPU API
- **WGSL** — шейдерный язык
- **gl-matrix** — линейная алгебра

## ✨ Реализовано

- ✅ **4 метода теней** — Shadow Mapping, PCF, PCSS, Variance Shadow Maps
- ✅ **Интерактивное управление** — параметры теней в реальном времени
- ✅ **Два режима камеры** — Orbit (вращение вокруг объекта) и FPS (свободное перемещение)
- ✅ **Загрузка моделей** — поддержка OBJ файлов
- ✅ **Grid с тенями** — процедурная сетка-приёмник теней
- ✅ **Визуализация света** — перемещаемая сфера источника света
- ✅ **Preset сцены** — Multiple Objects, Stairs, Forest для сравнения артефактов и производительности
- ✅ **60 FPS** — оптимизированный рендер

## 🎮 Управление

### Orbit Mode (по умолчанию)

- **Drag объект** — вращение объекта
- **Shift + Drag** — перемещение света
- **WASD/Стрелочки** — orbit камеры
- **Колесико мыши** — zoom
- **Ctrl + Click** — войти в FPS режим

### FPS Mode

- **WASD** — движение камеры
- **Мышь** — взгляд
- **Пробел** — вверх
- **Shift** — вниз
- **ESC** — выйти в Orbit режим

## 🚀 Быстрый старт

### Требования

- Node.js 18+ (рекомендуется 20+)
- Браузер с поддержкой WebGPU (Chrome/Edge 113+)
- **Linux:** включите флаги в `chrome://flags`
  - `#enable-unsafe-webgpu` → Enabled
  - `#enable-vulkan` → Enabled
  - Перезапустите браузер

### Установка

```bash
npm install
npm run dev
```

Откройте http://localhost:5173

### Сборка

```bash
npm run build
npm run preview
```

## 📁 Структура проекта

```
src/
├── components/
│   └── ControlPanel.tsx       # UI панель управления
├── engine/
│   ├── Renderer.ts            # Основной рендерер
│   ├── ArcballController.ts   # Вращение объекта
│   ├── CameraController.ts    # Управление камерой
│   └── LightDragger.ts        # Перемещение света
├── geometry/
│   └── SphereGenerator.ts     # Генерация сферы
├── gpu/
│   └── initWebGPU.ts          # Инициализация WebGPU
├── loaders/
│   └── ModelLoader.ts         # OBJ парсер
├── shaders/                   # WGSL шейдеры
│   ├── basic.wgsl             # Shadow Mapping
│   ├── pcf.wgsl               # PCF
│   ├── pcss.wgsl              # PCSS
│   ├── vsm.wgsl               # VSM
│   ├── depth.wgsl             # Shadow pass
│   ├── grid_solid.wgsl        # Grid с тенями
│   └── light_sphere.wgsl      # Визуализация света
└── utils/
    └── poissonDisk.ts         # Poisson disk sampling
```

## 🔬 Реализованные методы

### 1. Shadow Mapping (SM)

Классический алгоритм — жёсткие тени с чёткими краями.

- ⚡ Самый быстрый
- ⚠️ Алиасинг на краях

### 2. Percentage Closer Filtering (PCF)

Фильтрация — мягкие края через усреднение соседних texel.

- ✨ Сглаженные края
- 🎯 Настраиваемый радиус

### 3. Percentage Closer Soft Shadows (PCSS)

Динамические мягкие тени — размер полутени зависит от расстояния.

- 🌟 Реалистичные мягкие тени
- 📐 Пенумбра меняется с расстоянием

### 4. Variance Shadow Maps (VSM)

Предфильтрованные тени — хранение моментов глубины.

- 🚀 Быстрая фильтрация (compute shader)
- ⚠️ Light bleeding на тонких объектах

## 🛠️ Дорожная карта

### Готово ✅

- [x] Базовый рендер (куб, Lambert освещение)
- [x] Shadow Mapping
- [x] PCF фильтрация
- [x] PCSS мягкие тени
- [x] VSM/compute blur
- [x] Два режима камеры (orbit/FPS)
- [x] Загрузка OBJ моделей
- [x] Перемещаемый источник света

### В разработке 🚧

- [x] Метрики производительности (FPS timeline, frame time)
- [x] Визуализация Shadow Map (debug mode)
- [x] Preset сцены (Forest, Stairs, Multiple Objects)
- [ ] Экспорт отчётов (PDF, CSV, скриншоты)

## 🧪 Preset сцены

- **Multiple Objects** — несколько объектов разных форм, размеров и материалов для проверки multi-object shadow pass.
- **Stairs** — ступени разной высоты для оценки bias, aliasing, peter panning и поведения PCF/PCSS.
- **Forest** — набор тонких стволов и крон для проверки плотных теней, VSM light bleeding и FPS.

## 🐛 Частые проблемы

**❌ "Failed to request GPU adapter"**

- Проверьте `chrome://gpu` (WebGPU должен быть Hardware accelerated)
- Включите флаги WebGPU/Vulkan
- Обновите драйверы GPU

**❌ Низкий FPS**

- Уменьшите Shadow Map Size до 1024
- Уменьшите PCF Samples до 8

**❌ OBJ модель без теней**

- Убедитесь что у модели есть нормали (`vn` в файле)
- Модель должна быть над плоскостью (Y > -2.5)
