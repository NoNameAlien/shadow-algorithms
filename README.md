# Shadow Algorithms Lab (WebGPU)

Интерактивная веб-лаборатория для сравнения алгоритмов теней в реальном времени на WebGPU. Проект показывает, как меняются качество, артефакты и производительность при переключении между Shadow Mapping, PCF, PCSS и VSM.

Текущий объем проекта: интерактивная сцена, несколько объектов и источников света, сцены-пресеты, настройка материалов/света/окружения, отладочная визуализация карты теней и экспорт отчетов. CSM/EVSM пока не реализованы.

## Технический стек

- React 19
- TypeScript 5.8
- Vite 7
- WebGPU
- WGSL
- gl-matrix

## Быстрый старт

Требования:

- Node.js 18+; лучше Node.js 20+
- Chrome/Edge с WebGPU
- На Linux может потребоваться включить WebGPU/Vulkan в `chrome://flags`

```bash
npm install
npm run dev
```

Открыть:

```text
http://localhost:5173
```

Сборка:

```bash
npm run build
npm run preview
```

Проверки:

```bash
npm test
npm run lint
npm run build
```

## Что реализовано

- Четыре метода теней: `SM`, `PCF`, `PCSS`, `VSM`.
- Несколько объектов в сцене с отдельными параметрами трансформации, материала и теней.
- Несколько источников света: `sun`, `spot`, `top`.
- Добавление, удаление, выбор и переименование объектов/источников.
- Перемещение выбранного объекта или света клавиатурой и осями гизмо.
- Сцены-пресеты: `Multiple Objects`, `Stairs`, `Forest`, `Aliasing Test`, `Penumbra Test`, `Multi-light Test`, `VSM Bleeding Test`.
- Загрузка OBJ-моделей.
- Текстуры объекта и пола.
- Настройки пола, стен, размера пола и сетки.
- Отладочные режимы: итоговый вид, освещение, диффузная составляющая, блик, маска тени, нормали.
- Отладка активного источника: cone mask, distance falloff и active shadow visibility.
- Визуализация карты теней / моментов VSM по shadow slots `0..7`.
- Диагностика активного источника света: slot, projection, shadow far, effective bias, cone/range/falloff.
- Обработка `device.lost` с остановкой render loop и выводом ошибки WebGPU.
- Runtime validation импортируемой сцены.
- Масштаб объекта по осям и uniform scale.
- Метрики FPS и времени кадра.
- Экспорт сцены в JSON.
- Экспорт CSV, PDF и скриншота.
- Benchmark-экспорт одним ZIP-архивом с CSV/JSON/PDF по методам `SM`, `PCF`, `PCSS`, `VSM` для benchmark-сцен.

## Управление

Основной режим:

- Клик по объекту или источнику света выбирает его.
- Клик по пустому месту снимает фокус.
- Стрелки двигают выбранный объект или источник по X/Z.
- `Space` двигает выбранный объект или источник вверх.
- `Shift` двигает выбранный объект или источник вниз.
- Клик/перетаскивание по оси гизмо двигает выбранный объект или источник вдоль оси.
- Для выбранного `spot`-источника перетаскивание вне осей поворачивает прожектор.
- Колесо мыши меняет приближение.
- `Ctrl + Click` по холсту включает FPS-режим.
- Двойной клик по имени объекта/источника в панели включает переименование.

FPS-режим:

- `WASD` или стрелки двигают камеру.
- Мышь управляет взглядом.
- `Space` вверх.
- `Shift` вниз.
- `Esc` выход из FPS-режима.

## Структура проекта

```text
src/
├── App.tsx # верхний React-компонент, benchmark runner и экспорт отчетов
├── main.tsx # точка входа React-приложения
├── components/
│   ├── SceneViewport.tsx # canvas, FPS panel, debug preview, benchmark overlay
│   └── control-panel/ # UI управления сценой, объектами, светом, тенями и отчетами
│       ├── ControlPanel.tsx # сборка секций панели
│       ├── ShadowSettingsSection.tsx # выбор метода, quality presets, debug modes
│       ├── LightControls.tsx # настройки источников света
│       ├── ObjectControls.tsx # выбор и параметры объектов
│       ├── SceneControls.tsx # сцены, окружение, import/export
│       └── ...
├── engine/
│   ├── Renderer.ts # главный orchestrator WebGPU-сцены и render loop
│   ├── ArcballController.ts # вращение demo-объекта
│   ├── CameraController.ts # orbit/FPS camera и pointer lock
│   ├── ShadowRenderer.ts # shadow/VSM passes, resources, blur и debug
│   ├── MeshRegistry.ts # default meshes, OBJ loading и GPU buffers
│   ├── ObjectDrawStateRegistry.ts # per-object buffers и bind groups
│   ├── ObjectUniformWriter.ts # packing object uniforms/object params
│   ├── geometryData.ts # procedural geometry для meshes/gizmos
│   ├── interaction.ts # picking, ray hits, projection helpers
│   ├── math.ts # matrix helpers для projection
│   ├── pipelines.ts # WebGPU render/compute pipelines
│   ├── presets.ts # scene presets и benchmark scenes
│   ├── resources.ts # GPU textures, samplers и uniform buffers
│   ├── scene.ts # создание объектов/источников и DTO import/export
│   ├── shaderSources.ts # WGSL sources и include resolution
│   ├── shadowDescriptors.ts # shadow camera projection/target/up/far
│   ├── shadowSlots.ts # metadata для shadow slots
│   ├── shadows.ts # shadow slot assignment helpers
│   ├── textureUtils.ts # создание texture resources
│   ├── types.ts # общие renderer/scene/shadow/light типы
│   └── uniformLayouts.ts # TS-side uniform layout constants и packing
├── geometry/
│   └── SphereGenerator.ts # procedural sphere/icosphere generation
├── gpu/
│   └── initWebGPU.ts # adapter/device/context initialization
├── hooks/
│   ├── useRendererLifecycle.ts # создание Renderer, metrics, device lost errors
│   ├── useSceneController.ts # React-state UI и команды в renderer
│   └── useRendererControls.ts # вспомогательные renderer controls
├── loaders/
│   └── ModelLoader.ts # OBJ/model loading через loaders.gl
├── shaders/
│   ├── basic.wgsl # базовый Shadow Mapping
│   ├── pcf.wgsl # Percentage Closer Filtering
│   ├── pcss.wgsl # blocker search и variable filter radius
│   ├── vsm.wgsl # main pass для Variance Shadow Maps
│   ├── vsm_moments.wgsl # moments pass для VSM
│   ├── vsm_blur.wgsl # compute blur для VSM moments
│   ├── grid_solid.wgsl # floor/walls с SM/PCF/PCSS/VSM
│   ├── depth.wgsl # depth-only shadow pass
│   ├── debug_shadow_depth.wgsl # debug preview depth shadow map
│   ├── debug_vsm.wgsl # debug preview VSM moments
│   ├── light_beam.wgsl # визуальный луч прожектора
│   ├── axis_gizmo.wgsl # editor axis gizmo
│   └── modules/
│       ├── lighting_common.wgsl # общая light/shadow math
│       ├── object_common.wgsl # common object uniforms и vertex path
│       ├── object_single_shadow_main.wgsl # legacy/shared single-shadow path
│       └── poisson64.wgsl # Poisson sample kernels
└── utils/
    ├── color.ts # color conversion helpers
    ├── reportExport.ts # CSV/PDF/screenshot/ZIP export
    ├── sceneFile.ts # JSON scene file helpers
    ├── sceneValidation.ts # runtime validation импортируемой сцены
    └── shadowQuality.ts # quality presets и method labels
```

## Конвейер рендера

Общая схема кадра:

```text
Состояние сцены
  |
  | объекты, источники света, камера, параметры теней
  v
Обновление uniform-буферов
  |
  | viewProj, lightViewProj[] по shadow slots, параметры объектов, данные источников света
  v
Проход теней
  |
  | отрисовка объектов, отбрасывающих тень, из камеры света
  v
Карта теней / моменты VSM
  |
  | только VSM: размытие в вычислительном шейдере
  v
Основной проход сцены
  |
  | отрисовка объектов, пола и стен
  | чтение карты теней во фрагментном шейдере
  v
Отладочные оверлеи / гизмо / луч света
```

Текущая важная архитектурная оговорка: тени уже рендерятся через shadow slots. Для `SM`, `PCF` и `PCSS` используется `texture_depth_2d_array`, для `VSM` - массив слоев moments texture с отдельным blur по слоям. Назначение слотов сейчас автоматическое: первые источники света получают slots `0..7`, а UI показывает slot рядом с источником.

## Методы теней

Раздел ниже описывает четыре режима, которые можно сравнивать в лаборатории: `SM`, `PCF`, `PCSS` и `VSM`.

Кратко различие такое:

- `SM` — базовая карта теней. Для каждой точки сцены выполняется одно сравнение глубины: видит ли источник света эту точку напрямую или перед ней уже есть другой объект. Метод быстрый, но дает жесткий край тени и заметные ступеньки.
- `PCF` — сглаженная карта теней. Вместо одного сравнения глубины метод берет несколько соседних точек на карте теней и усредняет результат. Край становится мягче, но степень размытия почти везде одинаковая.
- `PCSS` — приближение мягких теней от источника света с ненулевым размером. Метод сначала ищет объект, который перекрывает свет, а затем подбирает ширину размытия: чем дальше освещаемая поверхность от такого объекта, тем шире полутень.
- `VSM` — карта теней на основе статистики глубины. Метод хранит не только глубину, но и величины для оценки разброса глубин. Это позволяет удобно размывать карту теней, но может давать лишнюю подсветку внутри темных областей.

> Важно: формулы ниже записаны обычным текстом, без LaTeX, KaTeX, MathJax и специальных математических блоков. Это сделано намеренно, чтобы README одинаково открывался в разных Markdown-рендерах.

### Общая идея Shadow Mapping

Сначала сцена рисуется с точки зрения источника света. Цвет в этот момент не важен: в текстуру записывается только глубина ближайшей поверхности. Затем, во время основного рендера, каждый фрагмент сцены проецируется в пространство источника света и сравнивается с глубиной, которая была сохранена ранее.

Формула перехода в пространство света простым текстом:

`p_light = M_light * p_world`

`p_ndc = p_light.xyz / p_light.w`

`uv = 0.5 * p_ndc.xy + 0.5`

`z_surface = p_ndc.z`

Базовая проверка видимости:

`V_lit = 1, если z_surface - depth_offset <= z_map`

`V_shadow = 0, если z_surface - depth_offset > z_map`

Где:

- `z_surface` — глубина текущей поверхности относительно источника света;
- `z_map` — глубина ближайшей поверхности, записанная в карте теней;
- `depth_offset` — небольшая поправка глубины, которая помогает уменьшить артефакт «теневой ряби» на поверхности;
- `V` — видимость источника света: `1` означает свет, `0` означает тень.

То же самое в псевдокоде:

```text
p_world = position of current fragment
p_light_clip = LightViewProj * vec4(p_world, 1)
p_ndc = p_light_clip.xyz / p_light_clip.w
uv = p_ndc.xy * 0.5 + 0.5
z_surface = p_ndc.z
z_map = shadowMap(uv)
depth_offset = small depth correction

visibility = z_surface - depth_offset <= z_map ? 1 : 0
```

Итоговое освещение можно представить так:

`L_out = C_base * (A + D * V * I)`

Где:

- `C_base` — базовый цвет материала;
- `A` — фоновое освещение;
- `D` — диффузная составляющая освещения;
- `V` — видимость источника света;
- `I` — интенсивность источника света.

Диффузная составляющая считается через угол между нормалью поверхности и направлением на источник света:

`D = max(dot(N, L), 0)`

Псевдокод:

```text
L = direction from fragment to light
N = surface normal
diffuse = max(dot(N, L), 0)
color = baseColor * (ambient + diffuse * visibility * lightIntensity)
```

### 1. SM: Shadow Mapping

`SM` — самый простой метод. Для каждого фрагмента выполняется одно сравнение глубины: если фрагмент находится дальше от источника света, чем глубина в карте теней, значит свет до него перекрыт другим объектом.

Формула простым текстом:

`V = compare(S, uv, z_surface - depth_offset)`

Развернутый вариант:

`V_lit = 1, если z_surface - depth_offset <= S(uv)`

`V_shadow = 0, если z_surface - depth_offset > S(uv)`

Где:

- `V` — видимость света;
- `S(uv)` — значение глубины в карте теней по координатам `uv`;
- `depth_offset` — поправка глубины для борьбы с самозатенением.

Псевдокод:

```text
visibility = compare(shadowMap, uv, z_surface - depth_offset)
```

Плюсы:

- быстрый;
- простой для понимания и отладки;
- хорошо показывает базовую идею карты теней.

Минусы:

- жесткие края тени;
- заметные ступеньки на границе тени;
- возможна «теневая рябь», если поправка глубины слишком маленькая;
- возможен эффект «оторванной тени», если поправка глубины слишком большая.

### 2. PCF: Percentage Closer Filtering

`PCF` развивает базовую карту теней. Вместо одного сравнения глубины метод делает несколько сравнений рядом с текущей координатой `uv`, а затем усредняет результат. Если часть соседних точек освещена, а часть находится в тени, итоговое значение получается промежуточным. Благодаря этому край тени выглядит мягче.

Формула простым текстом:

`V = average(compare(S, uv + offset_i, z_surface - depth_offset))`

То же самое чуть подробнее:

`V = сумма всех результатов сравнения / количество выборок`

Где:

- `offset_i` — смещение очередной выборки вокруг текущей точки;
- `S` — карта теней;
- `V` — итоговая видимость света.

Псевдокод:

```text
visibility = average(compare(shadowMap, uv + offset_i, z_surface - depth_offset))
```

Схема:

```text
одна выборка:
  [x]

PCF:
  [x x x]
  [x o x]  -> усредненная видимость
  [x x x]
```

Параметры:

- `pcfRadius` — радиус поиска соседних точек в текселях;
- `pcfSamples` — количество выборок.

Плюсы:

- сглаживает край тени;
- заметно дешевле, чем PCSS;
- хорошо подходит для учебной визуализации.

Минусы:

- мягкость края почти постоянная;
- не учитывает реальный размер источника света;
- при малом количестве выборок может быть виден шум или дискретный узор.

### 3. PCSS: Percentage Closer Soft Shadows

`PCSS` пытается приблизить поведение мягких теней от источника света с ненулевым размером. В реальности край тени становится мягче, когда поверхность, на которую падает тень, находится дальше от объекта, перекрывающего свет. PCSS имитирует это в два этапа.

Сначала метод ищет среднюю глубину объектов, перекрывающих свет рядом с текущей точкой. Затем по разнице между глубиной поверхности и глубиной перекрывающего объекта оценивается ширина полутени. После этого выполняется PCF, но радиус фильтра уже зависит от рассчитанной ширины полутени.

Формулы простым текстом:

`z_cover = среднее значение z_j для всех z_j, которые меньше z_surface`

`penumbra = (z_surface - z_cover) / z_cover`

`filterRadius = lightSize * penumbra`

`V = PCF(uv, filterRadius)`

Псевдокод:

```text
z_cover_avg = average(depth samples where z_sample < z_surface)
penumbra = (z_surface - z_cover_avg) / z_cover_avg
filterRadius = lightSize * penumbra
visibility = PCF(uv, filterRadius)
```

Схема:

```text
Light
  |      закрывающий объект
  |       |
  |       v
  |    [object]
  |
  +------------ поверхность

поверхность далеко -> широкая полутень
поверхность близко -> резкая тень
```

В проекте:

- `pcssLightSize` управляет размером виртуального источника света;
- `pcssBlockerSearchSamples` задает количество выборок при поиске объекта, перекрывающего свет;
- для распределения выборок используются смещения Пуассона.

Плюсы:

- тень становится мягче с расстоянием;
- визуально ближе к реальным мягким теням;
- хорошо показывает отличие обычного размытия от физически мотивированной полутени.

Минусы:

- дороже, чем PCF;
- чувствителен к поправке глубины и разрешению карты теней;
- на тонкой геометрии может появляться шум.

### 4. VSM: Variance Shadow Maps

`VSM` работает иначе, чем `SM`, `PCF` и `PCSS`. Он хранит не только глубину, а два момента распределения глубины. По ним можно оценить, насколько вероятно, что текущая точка освещена.

Формулы простым текстом:

`m1 = E[z]`

`m2 = E[z * z]`

`variance = m2 - m1 * m1`

После прохода теней текстура моментов размывается вычислительным шейдером. Затем видимость оценивается через верхнюю границу вероятности по неравенству Чебышева:

`p = variance / (variance + (d - m1) * (d - m1))`

`V = clamp(p, 0, 1)`

Где:

- `d` — глубина текущего фрагмента;
- `m1` — средняя глубина в выбранной области;
- `m2` — среднее значение квадрата глубины;
- `variance` — оценка разброса глубины.

Схема:

```text
Shadow pass:
  depth -> (depth, depth * depth)

Compute blur:
  moments texture -> blurred moments

Main pass:
  sample moments -> estimate probability of being lit
```

Плюсы:

- хорошо фильтруется;
- размытие можно делать вычислительным шейдером;
- мягкие края получаются без большого числа сравнений глубины.

Минусы:

- может давать лишнюю подсветку внутри тени;
- требует настройки `minVariance` и `lightBleedReduction`;
- для прожектора требует аккуратной depth-шкалы: в проекте spot/VSM использует perspective shadow projection и linearized depth для moments, чтобы footprint совпадал с поведением прожектора.

## Источники света

Типы:

- `sun` - позиционный источник без конуса и без затухания по расстоянию; светит от своей позиции к каждой точке сцены.
- `spot` - прожектор с направлением, внутренним/внешним конусом, радиусом действия и затуханием.
- `top` - вертикальный верхний источник.

Для `spot`:

```text
axis = direction(yaw, pitch)
toFrag = normalize(worldPos - lightPos)
cosAngle = dot(toFrag, axis)
spot = smooth factor between outerCone and innerCone
```

Затухание света с расстоянием:

```text
dist = distance(lightPos, worldPos)
t = clamp(dist / range, 0, 1)
attenuation = smoothRange(t) * distanceCurve(t)
```

### Тени от нескольких источников

Каждый источник света считает свою видимость. Если источник A закрыт объектом, а источник B видит ту же точку, итоговая область не станет полностью черной: второй источник ее досветит. Поэтому два источника могут давать две разные тени, а пересечение этих теней будет темнее.

Схематично:

```text
finalLight = ambient + lightA * visibilityA + lightB * visibilityB + ...
```

Интенсивность источника меняет яркость его вклада, но сама по себе не должна размывать тень. Мягкость края задается размером/радиусом источника, расстоянием между blocker и receiver, параметрами фильтрации и выбранным методом.

## Сцены-пресеты

- `Multiple Objects` - несколько объектов разных форм, размеров и материалов. Хорошо проверяет проход с несколькими объектами.
- `Stairs` - ступени разной высоты. Хорошо видно смещение глубины, ступеньки на краях теней и эффект оторванной тени, PCF/PCSS.
- `Forest` - много тонких стволов и крон. Хорошо проявляет засветы VSM внутри тени, плотные перекрытия и проблемы теней от нескольких источников.
- `Aliasing Test` - низкое разрешение `SM`, тонкие blocker-объекты и наклонный свет. Нужен, чтобы увидеть жесткие ступенчатые края shadow map.
- `Penumbra Test` - сцена солнечных часов для `PCSS`: гномон, часовые метки и низкий свет. Нужна, чтобы увидеть contact hardening и мягкость длинной тени на полу.
- `Multi-light Test` - яркие красный и синий spot-источники с разными shadow slots. Нужен, чтобы увидеть две независимые тени и их суммирование.
- `VSM Bleeding Test` - несколько прожекторов над сферами у стены. Нужен для проверки VSM blur, light bleeding, spot footprint и настройки `Light Bleed Reduction`.

## Частые проблемы

### Failed to request GPU adapter

- Проверьте `chrome://gpu`.
- Убедитесь, что WebGPU включен и аппаратно ускорен.
- Обновите драйвер GPU.
- На Linux проверьте Vulkan/WebGPU flags.

### Низкий FPS

- Уменьшите размер карты теней до `1024`.
- Уменьшите количество выборок PCF.
- Уменьшите количество объектов или источников.
- Отключите отладочную карту теней.

### Тени выглядят оторванными

- Уменьшите смещение глубины.
- Проверьте масштаб сцены и объекта.
- Для тонкой геометрии попробуйте PCF/VSM.

### Теневая рябь

- Увеличьте смещение глубины.
- Уменьшите силу тени.
- Увеличьте размер карты теней.
