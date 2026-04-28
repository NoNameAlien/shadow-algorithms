import { vec3, vec4, type mat4 } from 'gl-matrix';

export type ScreenPoint = {
  x: number;
  y: number;
  ok: boolean;
};

export function projectToScreen(
  point: vec3,
  viewProj: mat4,
  rect: Pick<DOMRect, 'width' | 'height'>
): ScreenPoint {
  const point4 = vec4.fromValues(point[0], point[1], point[2], 1.0);
  const clip = vec4.create();
  vec4.transformMat4(clip, point4, viewProj);

  const w = clip[3];
  if (w === 0) return { x: 0, y: 0, ok: false };

  const ndcX = clip[0] / w;
  const ndcY = clip[1] / w;

  return {
    x: (ndcX * 0.5 + 0.5) * rect.width,
    y: (1 - (ndcY * 0.5 + 0.5)) * rect.height,
    ok: true
  };
}

export function raySphereHit(origin: vec3, dir: vec3, center: vec3, radius: number): number {
  const oc = vec3.subtract(vec3.create(), origin, center);
  const a = vec3.dot(dir, dir);
  const b = 2 * vec3.dot(oc, dir);
  const c = vec3.dot(oc, oc) - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) return Number.POSITIVE_INFINITY;

  const sqrtD = Math.sqrt(discriminant);
  const t0 = (-b - sqrtD) / (2 * a);
  const t1 = (-b + sqrtD) / (2 * a);

  let t = Number.POSITIVE_INFINITY;
  if (t0 >= 0 && t0 < t) t = t0;
  if (t1 >= 0 && t1 < t) t = t1;

  return t;
}
