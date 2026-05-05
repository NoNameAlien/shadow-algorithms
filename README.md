# Shadow Algorithms Lab (WebGPU)

Интерактивная веб-лаборатория для сравнения алгоритмов теней в реальном времени на WebGPU. Проект показывает, как меняются качество, артефакты и производительность при переключении между Shadow Mapping, PCF, PCSS и VSM.

Текущий scope проекта: интерактивная сцена, несколько объектов и источников света, preset-сцены, настройка материалов/света/окружения, debug-визуализация shadow map и экспорт отчетов. CSM/EVSM пока не реализованы.

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
npm run lint
```

## Что реализовано

- 4 метода теней: `SM`, `PCF`, `PCSS`, `VSM`.
- Несколько объектов в сцене с отдельными transform/material/shadow параметрами.
- Несколько источников света: `sun`, `spot`, `top`.
- Добавление, удаление, выбор и переименование объектов/источников.
- Перемещение выбранного объекта или света клавиатурой и осями gizmo.
- Preset-сцены: `Multiple Objects`, `Stairs`, `Forest`.
- Загрузка OBJ-моделей.
- Текстуры объекта и пола.
- Настройки пола, стен, размера пола и сетки.
- Debug views: итоговый вид, lighting, diffuse, specular, shadow mask, normals.
- Визуализация shadow map / VSM moments.
- FPS/frame-time метрики.
- Экспорт сцены в JSON.
- Экспорт CSV/PDF/screenshot.

## Управление

Основной режим:

- Клик по объекту или источнику света выбирает его.
- Клик по пустому месту снимает фокус.
- Стрелки двигают выбранный объект или источник по X/Z.
- `Space` двигает выбранный объект или источник вверх.
- `Shift` двигает выбранный объект или источник вниз.
- Клик/drag по оси gizmo двигает выбранный объект или источник вдоль оси.
- Для выбранного `spot`-источника drag вне осей поворачивает прожектор.
- Колесо мыши меняет zoom.
- `Ctrl + Click` по canvas включает FPS-режим.
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
├── App.tsx
├── components/
│   ├── SceneViewport.tsx
│   └── control-panel/
│       ├── ControlPanel.tsx
│       ├── ShadowSettingsSection.tsx
│       ├── LightControls.tsx
│       ├── ObjectControls.tsx
│       ├── SceneControls.tsx
│       └── ...
├── engine/
│   ├── Renderer.ts
│   ├── ArcballController.ts
│   ├── CameraController.ts
│   ├── geometryData.ts
│   ├── interaction.ts
│   ├── math.ts
│   ├── pipelines.ts
│   ├── presets.ts
│   ├── resources.ts
│   ├── scene.ts
│   ├── shaderSources.ts
│   ├── textureUtils.ts
│   └── types.ts
├── geometry/
│   └── SphereGenerator.ts
├── gpu/
│   └── initWebGPU.ts
├── loaders/
│   └── ModelLoader.ts
├── shaders/
│   ├── basic.wgsl
│   ├── pcf.wgsl
│   ├── pcss.wgsl
│   ├── vsm.wgsl
│   ├── vsm_moments.wgsl
│   ├── vsm_blur.wgsl
│   ├── grid_solid.wgsl
│   ├── depth.wgsl
│   └── modules/
│       ├── lighting_common.wgsl
│       ├── object_common.wgsl
│       ├── object_single_shadow_main.wgsl
│       └── poisson64.wgsl
└── utils/
    ├── color.ts
    ├── reportExport.ts
    └── sceneFile.ts
```

## Render pipeline

Общая схема кадра:

```text
Scene state
  |
  | objects, lights, camera, shadow params
  v
Update uniforms
  |
  | viewProj, lightViewProj, object params, light data
  v
Shadow pass
  |
  | draw shadow-casting objects from light camera
  v
Shadow map / VSM moments
  |
  | VSM only: compute blur
  v
Main scene pass
  |
  | draw objects + floor + walls
  | sample shadow map in fragment shader
  v
Debug overlays / gizmo / light beam
```

Текущая важная архитектурная оговорка: освещение поддерживает несколько источников, но shadow map пока фактически рассчитана на одного главного shadow-caster. Для корректных теней от всех источников нужен shadow atlas или `texture_depth_2d_array`.

## Методы теней

Раздел ниже описывает четыре режима, которые можно сравнивать в лаборатории: `SM`, `PCF`, `PCSS` и `VSM`.

Кратко различие такое:

- `SM` отвечает на вопрос: **точка видна источнику света или закрыта?** Используется один depth compare, поэтому тень получается жесткой.
- `PCF` делает то же самое, но **несколько раз рядом с текущей точкой** и усредняет результат. Поэтому край тени выглядит мягче, но мягкость почти постоянная.
- `PCSS` дополнительно ищет blocker и оценивает **размер полутени**. Чем дальше receiver от blocker, тем шире и мягче край.
- `VSM` не делает классический depth compare. Он хранит статистику глубины — моменты — и оценивает вероятность того, что точка освещена. Это удобно фильтровать и размывать, но может появляться light bleeding.

### Общая идея Shadow Mapping

Сначала сцена рендерится из позиции/направления источника света. Вместо цвета сохраняется глубина ближайшей поверхности. Затем при основном рендеринге каждый фрагмент проецируется в пространство света и сравнивается с сохраненной глубиной.

Математическая запись преобразования фрагмента в пространство света:

$$
egin{aligned}
p_{clip}^{light} &= M_{lightViewProj} \cdot egin{bmatrix}p_{world} \ 1\end{bmatrix}, \
p_{ndc}^{light} &= rac{p_{clip}^{light}.xyz}{p_{clip}^{light}.w}, \
uv &= p_{ndc}^{light}.xy \cdot 0.5 + 0.5, \
z_{receiver} &= p_{ndc}^{light}.z.
\end{aligned}
$$

Базовая проверка видимости:

$$
visibility =
egin{cases}
1, & z_{receiver} - bias \le z_{occluder}, \
0, & z_{receiver} - bias > z_{occluder}.
\end{cases}
$$

Где:

- $z_{receiver}$ — глубина текущего фрагмента относительно источника света;
- $z_{occluder}$ — глубина ближайшей поверхности, записанная в shadow map;
- $bias$ — небольшая поправка, которая уменьшает shadow acne.

То же самое в псевдокоде:

```text
p_world = position of current fragment
p_light_clip = LightViewProj * vec4(p_world, 1)
p_ndc = p_light_clip.xyz / p_light_clip.w
uv = p_ndc.xy * 0.5 + 0.5
z_receiver = p_ndc.z
z_occluder = shadowMap(uv)

visibility = z_receiver - bias <= z_occluder ? 1 : 0
```

Итоговое освещение можно представить так:

$$
L_{out} = baseColor \cdot \left(ambient + diffuse \cdot visibility \cdot lightIntensityight)
$$

Где диффузная часть обычно считается через скалярное произведение нормали и направления на свет:

$$
diffuse = \max(N \cdot L, 0)
$$

```text
L = direction from fragment to light
N = surface normal
diffuse = max(dot(N, L), 0)
color = baseColor * (ambient + diffuse * visibility * lightIntensity)
```

### 1. SM: Shadow Mapping

`SM` — самый базовый метод. Для каждого фрагмента выполняется один depth compare: если фрагмент дальше от источника, чем значение в shadow map, значит между ним и светом есть другой объект, и фрагмент находится в тени.

Математически:

$$
visibility = compare\left(shadowMap, uv, z_{receiver} - biasight)
$$

Или в развернутом виде:

$$
visibility =
egin{cases}
1, & z_{receiver} - bias \le shadowMap(uv), \
0, & z_{receiver} - bias > shadowMap(uv).
\end{cases}
$$

```text
visibility = compare(shadowMap, uv, z_receiver - bias)
```

Схема:

```text
Light camera
    |
    v
depth map = closest depth from light

Main camera fragment
    |
    v
project fragment into light space
compare(fragmentDepth, shadowMapDepth)
```

Плюсы:

- быстрый;
- простой;
- хорошо показывает базовую идею shadow map.

Минусы:

- жесткие края;
- aliasing;
- shadow acne при малом bias;
- peter panning при большом bias.

### 2. PCF: Percentage Closer Filtering

`PCF` — это сглаженная версия обычного Shadow Mapping. Вместо одного сравнения метод делает несколько сравнений вокруг текущего `uv`, а затем усредняет результат. Поэтому край тени становится не бинарным, а постепенным.

Главное отличие от `SM`: `SM` возвращает только `0` или `1`, а `PCF` может вернуть промежуточное значение, например `0.35` или `0.7`.

Математически:

$$
visibility = rac{1}{n}\sum_{i=1}^{n} compare\left(shadowMap, uv + offset_i, z_{receiver} - biasight)
$$

Где:

- $n$ — количество сэмплов;
- $offset_i$ — смещение очередного сэмпла относительно текущего `uv`;
- результат — средняя доля сэмплов, которые оказались освещенными.

```text
visibility = 1 / n * sum(compare(shadowMap, uv + offset_i, z_receiver - bias))
```

Схема:

```text
single lookup:
  [x]

PCF:
  [x x x]
  [x o x]  -> average visibility
  [x x x]
```

Параметры:

- `pcfRadius` — радиус сэмплов в texel;
- `pcfSamples` — количество сэмплов.

Плюсы:

- сглаживает край тени;
- дешево относительно PCSS;
- стабильно для учебной визуализации.

Минусы:

- мягкость края постоянная;
- не моделирует физическую пенумбру;
- при большом радиусе может выглядеть как простое размытие, а не реалистичная мягкая тень.

### 3. PCSS: Percentage Closer Soft Shadows

`PCSS` пытается приблизить мягкие тени от источника конечного размера. В реальности тень становится мягче, когда receiver находится дальше от blocker. Поэтому `PCSS` сначала ищет среднюю глубину blocker'ов, а потом увеличивает радиус PCF в зависимости от расстояния между blocker и receiver.

Главное отличие от `PCF`: в `PCF` радиус фильтра почти фиксированный, а в `PCSS` радиус зависит от геометрии сцены. Близко к объекту тень резче, дальше от объекта — мягче.

Алгоритм состоит из двух этапов:

1. Поиск blocker depth.
2. PCF с радиусом, зависящим от расстояния между receiver и blocker.

Математически средняя глубина blocker'ов:

$$
z_{blockerAvg} = rac{1}{k}\sum_{j=1}^{k} z_j, \quad z_j < z_{receiver}
$$

Оценка размера полутени:

$$
penumbra = rac{z_{receiver} - z_{blockerAvg}}{z_{blockerAvg}}
$$

Радиус фильтрации:

$$
filterRadius = lightSize \cdot penumbra
$$

Финальная видимость:

$$
visibility = rac{1}{n}\sum_{i=1}^{n} compare\left(shadowMap, uv + offset_i \cdot filterRadius, z_{receiver} - biasight)
$$

```text
z_blocker_avg = average(depth samples where z_sample < z_receiver)
penumbra = (z_receiver - z_blocker_avg) / z_blocker_avg
filterRadius = lightSize * penumbra
visibility = PCF(uv, filterRadius)
```

Схема:

```text
Light
  \      blocker
   \       |
    \      v
     \   [object]
             \________ receiver

far receiver -> wider penumbra
near receiver -> sharper shadow
```

В проекте:

- `pcssLightSize` управляет размером виртуального источника;
- `pcssBlockerSearchSamples` задает число сэмплов поиска blocker;
- фильтрация использует poisson offsets.

Плюсы:

- тень становится мягче с расстоянием;
- визуально ближе к реальным мягким теням;
- хорошо показывает разницу между простым blur и contact-hardening shadows.

Минусы:

- дороже PCF;
- чувствителен к bias и разрешению shadow map;
- может шуметь на тонкой геометрии;
- blocker search добавляет нестабильность при сложной или плотной сцене.

### 4. VSM: Variance Shadow Maps

`VSM` работает иначе: вместо одного значения глубины он хранит два момента распределения глубины. Это позволяет размывать shadow texture обычной фильтрацией или compute blur'ом, а потом оценивать вероятность того, что receiver освещен.

Главное отличие от `SM/PCF/PCSS`: эти методы сравнивают глубину напрямую, а `VSM` работает со статистической оценкой. Поэтому `VSM` хорошо фильтруется, но может ошибаться и пропускать свет там, где должна быть тень.

Моменты:

$$
m_1 = E[z]
$$

$$
m_2 = E[z^2]
$$

Дисперсия:

$$
\sigma^2 = m_2 - m_1^2
$$

Оценка верхней границы вероятности через неравенство Чебышева:

$$
p_{max} = rac{\sigma^2}{\sigma^2 + (z_{receiver} - m_1)^2}
$$

Практическая версия с минимальной дисперсией:

$$
variance = \max(m_2 - m_1^2, minVariance)
$$

$$
visibility = clamp\left(rac{variance}{variance + (z_{receiver} - m_1)^2}, 0, 1ight)
$$

```text
m1 = E[z]
m2 = E[z^2]
variance = m2 - m1^2
```

```text
d = z_receiver
variance = max(m2 - m1^2, minVariance)
p = variance / (variance + (d - m1)^2)
visibility = clamp(p, 0, 1)
```

Схема:

```text
Shadow pass:
  depth -> (depth, depth^2)

Compute blur:
  moments texture -> blurred moments

Main pass:
  sample moments -> estimate probability of being lit
```

Плюсы:

- хорошо фильтруется;
- blur можно делать compute shader'ом;
- мягкие края без большого числа depth compare;
- удобен для демонстрации moments texture и post-processing подхода.

Минусы:

- light bleeding;
- требует настройки `minVariance` и `lightBleedReduction`;
- multi-light VSM сложнее: для каждого источника нужны свои moments и blur;
- статистическая оценка может давать визуально правдоподобный, но не всегда физически корректный результат.

## Источники света

Типы:

- `sun` - позиционный источник без конуса и без distance falloff; светит от своей позиции к каждой точке сцены.
- `spot` - прожектор с направлением, inner/outer cone, range и falloff.
- `top` - вертикальный верхний источник.

Для `spot`:

```text
axis = direction(yaw, pitch)
toFrag = normalize(worldPos - lightPos)
cosAngle = dot(toFrag, axis)
spot = smooth factor between outerCone and innerCone
```

Distance falloff:

```text
dist = distance(lightPos, worldPos)
t = clamp(dist / range, 0, 1)
falloff = smoothRange(t) * distanceCurve(t)
```

## Preset-сцены

- `Multiple Objects` - несколько объектов разных форм, размеров и материалов. Хорошо проверяет multi-object pass.
- `Stairs` - ступени разной высоты. Хорошо видно bias, aliasing, peter panning, PCF/PCSS.
- `Forest` - много тонких стволов и крон. Хорошо проявляет VSM light bleeding, плотные перекрытия и проблемы multi-shadow.

## Ограничения текущей версии

1. Нет полноценного multi-shadow для всех источников света.
   Сейчас освещение multi-light, но shadow map path ограничен главным shadow-caster. Для корректных теней от всех источников нужен shadow atlas или `texture_depth_2d_array`.

2. VSM не масштабирован на несколько shadow-caster.
   Для этого нужны moments texture array и blur per layer.

3. GLTF loader есть в коде/зависимостях, но пользовательский сценарий сейчас ориентирован на OBJ.

4. `Renderer.ts` большой и требует декомпозиции.

5. Lint пока не является зеленым quality gate.

## Roadmap

Ближайшие инженерные задачи:

- Починить lint.
- Добавить `MeshDef.indexFormat`.
- Вынести shadow pipeline из `Renderer.ts`.
- Реализовать shadow map array для `SM/PCF`.
- Расширить multi-shadow на `PCSS`.
- Отдельно спроектировать multi-light VSM.
- Добавить runtime validation для scene JSON.
- Добавить benchmark runner: warmup, fixed duration, p50/p95/p99 frame time.

## Частые проблемы

### Failed to request GPU adapter

- Проверьте `chrome://gpu`.
- Убедитесь, что WebGPU включен и аппаратно ускорен.
- Обновите драйвер GPU.
- На Linux проверьте Vulkan/WebGPU flags.

### Низкий FPS

- Уменьшите `Shadow Map Size` до `1024`.
- Уменьшите `PCF Samples`.
- Уменьшите количество объектов или источников.
- Отключите debug shadow map.

### Тени выглядят оторванными

- Уменьшите `bias`.
- Проверьте масштаб сцены и объекта.
- Для тонкой геометрии попробуйте PCF/VSM.

### Shadow acne

- Увеличьте `bias`.
- Уменьшите `shadowStrength`.
- Увеличьте `Shadow Map Size`.
