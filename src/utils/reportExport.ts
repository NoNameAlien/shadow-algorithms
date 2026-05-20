import type { PerformanceMetrics } from '../engine/types';
import type { ShadowParams } from '../components/control-panel/types';

type SceneSnapshot = {
  lights: unknown[];
  objects: unknown[];
};

export type ReportSnapshot = {
  timestamp: string;
  shadowParams: ShadowParams;
  performanceMetrics: PerformanceMetrics;
  scene: SceneSnapshot;
};

export type BenchmarkSample = {
  presetId: string;
  presetLabel: string;
  method: ShadowParams['method'];
  shadowParams: ShadowParams;
  performanceMetrics: PerformanceMetrics;
  frameTimeP50Ms: number;
  frameTimeP95Ms: number;
  frameTimeP99Ms: number;
  screenshot?: BenchmarkScreenshot;
  findings: string[];
};

export type BenchmarkScreenshot = {
  dataUrl: string;
  width: number;
  height: number;
};

export type BenchmarkReport = {
  timestamp: string;
  scenePresets: string[];
  warmupMs: number;
  sampleMs: number;
  orbitSteps: number;
  scene: SceneSnapshot;
  samples: BenchmarkSample[];
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const uint16 = (value: number) => {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
};

const uint32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
};

const createZipBlob = (files: Array<{ name: string; bytes: Uint8Array }>) => {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encodeAscii(file.name);
    const checksum = crc32(file.bytes);
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(file.bytes.length),
      uint32(file.bytes.length),
      uint16(name.length),
      uint16(0),
      name,
    ]);

    chunks.push(localHeader, file.bytes);
    centralDirectory.push(concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(file.bytes.length),
      uint32(file.bytes.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      name,
    ]));
    offset += localHeader.length + file.bytes.length;
  }

  const centralOffset = offset;
  const centralBytes = concatBytes(centralDirectory);
  const end = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralBytes.length),
    uint32(centralOffset),
    uint16(0),
  ]);

  return new Blob([concatBytes([...chunks, centralBytes, end])], { type: 'application/zip' });
};

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const flattenReport = (report: ReportSnapshot) => ({
  timestamp: report.timestamp,
  method: report.shadowParams.method,
  shadowMapSize: report.shadowParams.shadowMapSize,
  bias: report.shadowParams.bias,
  pcfRadius: report.shadowParams.pcfRadius ?? '',
  pcfSamples: report.shadowParams.pcfSamples ?? '',
  pcssLightSize: report.shadowParams.pcssLightSize ?? '',
  pcssBlockerSearchSamples: report.shadowParams.pcssBlockerSearchSamples ?? '',
  vsmMinVariance: report.shadowParams.vsmMinVariance ?? '',
  vsmLightBleedReduction: report.shadowParams.vsmLightBleedReduction ?? '',
  shadowStrength: report.shadowParams.shadowStrength ?? '',
  ambientStrength: report.shadowParams.ambientStrength ?? '',
  exposure: report.shadowParams.exposure ?? '',
  hemisphereSkyColor: report.shadowParams.hemisphereSkyColor?.join('/') ?? '',
  hemisphereGroundColor: report.shadowParams.hemisphereGroundColor?.join('/') ?? '',
  lightDebugMode: report.shadowParams.lightDebugMode ?? 'final',
  debugShadowMap: report.shadowParams.debugShadowMap ?? 'off',
  fps: report.performanceMetrics.fps,
  averageFps: report.performanceMetrics.averageFps,
  recentMinFps: report.performanceMetrics.recentMinFps,
  recentMaxFps: report.performanceMetrics.recentMaxFps,
  sessionMinFps: report.performanceMetrics.sessionMinFps,
  sessionMaxFps: report.performanceMetrics.sessionMaxFps,
  frameTimeMs: report.performanceMetrics.frameTimeMs.toFixed(2),
  averageFrameTimeMs: report.performanceMetrics.averageFrameTimeMs.toFixed(2),
  maxFrameTimeMs: report.performanceMetrics.maxFrameTimeMs.toFixed(2),
  lights: report.scene.lights.length,
  objects: report.scene.objects.length
});

export const downloadReportCsv = (report: ReportSnapshot, filename: string) => {
  const row = flattenReport(report);
  const headers = Object.keys(row);
  const values = Object.values(row).map(csvEscape);
  const csv = `${headers.join(',')}\n${values.join(',')}\n`;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
};

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index];
};

export const createBenchmarkSample = (
  presetId: string,
  presetLabel: string,
  method: ShadowParams['method'],
  shadowParams: ShadowParams,
  performanceMetrics: PerformanceMetrics,
  screenshot?: BenchmarkScreenshot,
): BenchmarkSample => {
  const history = performanceMetrics.frameTimeHistory.filter((value) => Number.isFinite(value) && value > 0);

  return {
    presetId,
    presetLabel,
    method,
    shadowParams,
    performanceMetrics,
    frameTimeP50Ms: percentile(history, 0.5),
    frameTimeP95Ms: percentile(history, 0.95),
    frameTimeP99Ms: percentile(history, 0.99),
    screenshot,
    findings: createBenchmarkFindings(method, shadowParams, performanceMetrics, history),
  };
};

const flattenBenchmarkSample = (report: BenchmarkReport, sample: BenchmarkSample) => ({
  timestamp: report.timestamp,
  scenePreset: sample.presetId,
  sceneLabel: sample.presetLabel,
  method: sample.method,
  shadowMapSize: sample.shadowParams.shadowMapSize,
  bias: sample.shadowParams.bias,
  pcfRadius: sample.shadowParams.pcfRadius ?? '',
  pcfSamples: sample.shadowParams.pcfSamples ?? '',
  pcssLightSize: sample.shadowParams.pcssLightSize ?? '',
  pcssBlockerSearchSamples: sample.shadowParams.pcssBlockerSearchSamples ?? '',
  vsmMinVariance: sample.shadowParams.vsmMinVariance ?? '',
  vsmLightBleedReduction: sample.shadowParams.vsmLightBleedReduction ?? '',
  shadowStrength: sample.shadowParams.shadowStrength ?? '',
  fps: sample.performanceMetrics.fps,
  averageFps: sample.performanceMetrics.averageFps,
  frameTimeMs: sample.performanceMetrics.frameTimeMs.toFixed(2),
  averageFrameTimeMs: sample.performanceMetrics.averageFrameTimeMs.toFixed(2),
  frameTimeP50Ms: sample.frameTimeP50Ms.toFixed(2),
  frameTimeP95Ms: sample.frameTimeP95Ms.toFixed(2),
  frameTimeP99Ms: sample.frameTimeP99Ms.toFixed(2),
  maxFrameTimeMs: sample.performanceMetrics.maxFrameTimeMs.toFixed(2),
  lights: report.scene.lights.length,
  objects: report.scene.objects.length,
  warmupMs: report.warmupMs,
  sampleMs: report.sampleMs,
  orbitSteps: report.orbitSteps,
  findings: sample.findings.join(' | '),
});

export const downloadBenchmarkJson = (report: BenchmarkReport, filename: string) => {
  downloadBlob(new Blob([createBenchmarkJsonText(report)], { type: 'application/json;charset=utf-8' }), filename);
};

const createBenchmarkJsonText = (report: BenchmarkReport) => `${JSON.stringify(report, null, 2)}\n`;

const createBenchmarkCsvText = (report: BenchmarkReport) => {
  const rows = report.samples.map((sample) => flattenBenchmarkSample(report, sample));
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(',')),
  ].join('\n') + '\n';
};

export const downloadBenchmarkCsv = (report: BenchmarkReport, filename: string) => {
  const csv = createBenchmarkCsvText(report);
  if (!csv) return;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
};

const createBenchmarkFindings = (
  method: ShadowParams['method'],
  shadowParams: ShadowParams,
  metrics: PerformanceMetrics,
  history: number[],
) => {
  const findings: string[] = [];
  const p95 = percentile(history, 0.95);

  if (method === 'SM') {
    findings.push('Fast baseline with hard binary shadow edges.');
    if (shadowParams.shadowMapSize <= 1024) findings.push('Low shadow map size should expose aliasing and jagged edges.');
  }
  if (method === 'PCF') {
    findings.push('Filtered shadow edges; softness is controlled by radius and sample count.');
  }
  if (method === 'PCSS') {
    findings.push('Expected to show contact hardening when blockers are at different distances.');
  }
  if (method === 'VSM') {
    findings.push('Blur-friendly moments method; watch for light bleeding on thin occluders.');
  }
  if (p95 > 24) findings.push('p95 frame time is high; this setting may be visibly unstable.');
  if (metrics.averageFps >= 55) findings.push('Average FPS is near realtime target.');
  if (metrics.averageFps > 0 && metrics.averageFps < 45) findings.push('Average FPS is below realtime target.');

  return findings;
};

const dataUrlToBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const concatBytes = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

const encodeAscii = (text: string) => new TextEncoder().encode(text);

type PdfObject = Uint8Array[];

const makePdfObject = (...chunks: Array<string | Uint8Array>): PdfObject =>
  chunks.map((chunk) => (typeof chunk === 'string' ? encodeAscii(chunk) : chunk));

const createTextCommands = (lines: string[], startY = 790) =>
  lines
    .slice(0, 38)
    .map((line, index) => `BT /F1 10 Tf 42 ${startY - index * 16} Td (${pdfEscape(line)}) Tj ET`)
    .join('\n');

const writePdf = (objects: PdfObject[]) => {
  const chunks: Uint8Array[] = [encodeAscii('%PDF-1.4\n')];
  const offsets = [0];
  let length = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(length);
    const prefix = encodeAscii(`${index + 1} 0 obj\n`);
    const suffix = encodeAscii('\nendobj\n');
    const objectBytes = concatBytes(object);
    chunks.push(prefix, objectBytes, suffix);
    length += prefix.length + objectBytes.length + suffix.length;
  });

  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(encodeAscii(xref));

  return concatBytes(chunks);
};

const createBenchmarkPdfBytes = (report: BenchmarkReport) => {
  const objects: PdfObject[] = [];
  const pageObjectIds: number[] = [];
  const addObject = (object: PdfObject) => {
    objects.push(object);
    return objects.length;
  };
  const setObject = (id: number, object: PdfObject) => {
    objects[id - 1] = object;
  };

  const catalogId = addObject(makePdfObject(''));
  const pagesId = addObject(makePdfObject(''));
  const fontId = addObject(makePdfObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

  const addPage = (lines: string[], images: BenchmarkScreenshot[] = []) => {
    const imageObjects = images.slice(0, 4).map((image) => {
      const bytes = dataUrlToBytes(image.dataUrl);
      return addObject(makePdfObject(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
        bytes,
        '\nendstream',
      ));
    });
    const imageResources = imageObjects.map((id, index) => `/Im${index + 1} ${id} 0 R`).join(' ');
    const imageCommands = imageObjects
      .map((_, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const width = 240;
        const height = 135;
        const x = 42 + col * 270;
        const y = 80 + (1 - row) * 165;
        return `q ${width} 0 0 ${height} ${x} ${y} cm /Im${index + 1} Do Q`;
      })
      .join('\n');
    const content = `${createTextCommands(lines, images.length ? 790 : 790)}\n${imageCommands}`;
    const contentId = addObject(makePdfObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    const pageId = addObject(makePdfObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> /XObject << ${imageResources} >> >> /Contents ${contentId} 0 R >>`,
    ));
    pageObjectIds.push(pageId);
  };

  const chunk = <T,>(items: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  };

  const bestByScene = report.scenePresets.map((presetId) => {
    const sceneSamples = report.samples.filter((sample) => sample.presetId === presetId);
    const best = sceneSamples
      .filter((sample) => sample.performanceMetrics.averageFps > 0)
      .sort((left, right) => right.performanceMetrics.averageFps - left.performanceMetrics.averageFps)[0];
    return best ? `${best.presetLabel}: fastest ${best.method} at ${best.performanceMetrics.averageFps} avg FPS` : `${presetId}: no FPS data`;
  });

  addPage([
    'Shadow Algorithms Benchmark',
    `Generated: ${report.timestamp}`,
    `Scenes: ${report.scenePresets.join(', ')}`,
    `Warmup: ${report.warmupMs} ms, sample: ${report.sampleMs} ms, orbit steps: ${report.orbitSteps}`,
    '',
    'Short conclusions:',
    ...bestByScene,
    '',
    'Interpretation notes:',
    'SM is the hard-shadow baseline and should expose aliasing on low resolution maps.',
    'PCF trades more samples for smoother but mostly uniform soft edges.',
    'PCSS should show contact hardening when blocker and receiver distances differ.',
    'VSM is blur-friendly, but thin occluders can expose light bleeding.',
  ]);

  for (const presetId of report.scenePresets) {
    const sceneSamples = report.samples.filter((sample) => sample.presetId === presetId);
    const first = sceneSamples[0];
    const samplePages = chunk(sceneSamples, 4);
    for (let pageIndex = 0; pageIndex < Math.max(1, samplePages.length); pageIndex++) {
      const pageSamples = samplePages[pageIndex] ?? [];
      addPage(
        [
          `Scene: ${first?.presetLabel ?? presetId}${samplePages.length > 1 ? ` (${pageIndex + 1}/${samplePages.length})` : ''}`,
          ...pageSamples.flatMap((sample) => [
            `${sample.method} ${sample.shadowParams.shadowMapSize}px: avg ${sample.performanceMetrics.averageFps} FPS, p95 ${sample.frameTimeP95Ms.toFixed(2)} ms`,
            `  ${sample.findings.slice(0, 2).join(' ')}`,
          ]),
        ],
        pageSamples.map((sample) => sample.screenshot).filter((image): image is BenchmarkScreenshot => Boolean(image)),
      );
    }
  }

  setObject(catalogId, makePdfObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));
  setObject(
    pagesId,
    makePdfObject(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`),
  );

  return writePdf(objects);
};

export const downloadBenchmarkPdf = (report: BenchmarkReport, filename: string) => {
  downloadBlob(new Blob([createBenchmarkPdfBytes(report)], { type: 'application/pdf' }), filename);
};

export const downloadBenchmarkArchive = (report: BenchmarkReport, basename: string) => {
  const files = [
    { name: `${basename}.json`, bytes: encodeAscii(createBenchmarkJsonText(report)) },
    { name: `${basename}.csv`, bytes: encodeAscii(createBenchmarkCsvText(report)) },
    { name: `${basename}.pdf`, bytes: createBenchmarkPdfBytes(report) },
  ];
  downloadBlob(createZipBlob(files), `${basename}.zip`);
};

export const downloadCanvasScreenshot = (canvas: HTMLCanvasElement, filename: string) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      alert('Не удалось создать скриншот canvas');
      return;
    }

    downloadBlob(blob, filename);
  }, 'image/png');
};

const pdfEscape = (value: string) =>
  value
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');

export const downloadReportPdf = (report: ReportSnapshot, filename: string) => {
  const row = flattenReport(report);
  const lines = [
    'Shadow Algorithms Report',
    `Generated: ${row.timestamp}`,
    '',
    `Method: ${row.method}`,
    `Shadow map size: ${row.shadowMapSize}`,
    `Bias: ${row.bias}`,
    `Shadow strength: ${row.shadowStrength}`,
    `Ambient strength: ${row.ambientStrength}`,
    `Exposure: ${row.exposure}`,
    `Sky ambient: ${row.hemisphereSkyColor}`,
    `Ground ambient: ${row.hemisphereGroundColor}`,
    `Light debug view: ${row.lightDebugMode}`,
    `Debug shadow map: ${row.debugShadowMap}`,
    '',
    `FPS: ${row.fps}`,
    `Session avg FPS: ${row.averageFps}`,
    `Session min/max FPS: ${row.sessionMinFps} / ${row.sessionMaxFps}`,
    `Recent min/max FPS: ${row.recentMinFps} / ${row.recentMaxFps}`,
    `Frame time: ${row.frameTimeMs} ms`,
    `Frame avg/max: ${row.averageFrameTimeMs} / ${row.maxFrameTimeMs} ms`,
    '',
    `Lights: ${row.lights}`,
    `Objects: ${row.objects}`
  ];

  const textCommands = lines
    .map((line, index) => `BT /F1 11 Tf 50 ${780 - index * 18} Td (${pdfEscape(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), filename);
};
