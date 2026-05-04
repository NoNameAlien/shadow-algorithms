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
