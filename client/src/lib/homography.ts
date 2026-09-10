/**
 * Table ↔ projector ↔ camera geometry.
 *
 * Everything on the table is described in inches in the cut-plan frame: the
 * reference rectangle (a full slab butted against the table stops) has corners
 * TL (0,0), TR (L,0), BR (L,W), BL (0,W), y-down like the slab picture on the TV.
 *
 * A calibration "plane" is where those four corners land on the projector
 * screen (or in the camera image) for a slab of a given thickness. The top of a
 * thick slab is closer to the projector, so the corners spread; with two planes
 * calibrated the corners for any thickness are interpolated linearly, which is
 * accurate to well under a pixel over an 8" range at a 9 ft throw.
 */
export type Pt = [number, number];
export interface Plane { thicknessIn: number; corners: [Pt, Pt, Pt, Pt] }
export interface DeviceCal { screenW?: number; screenH?: number; imgW?: number; imgH?: number; planes: Plane[] }
export interface Calibration { refLengthIn: number; refWidthIn: number; projector: DeviceCal | null; camera: DeviceCal | null; updatedAt?: string }

export const refCorners = (L: number, W: number): [Pt, Pt, Pt, Pt] => [[0, 0], [L, 0], [L, W], [0, W]];

/** Homography (3x3 row-major, h[8]=1) mapping 4 src points onto 4 dst points. */
export function solveHomography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    const d = A[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / d;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return [...b.map((v, i) => v / (A[i][i] || 1e-12)), 1];
}

export function applyH(h: number[], [x, y]: Pt): Pt {
  const w = h[6] * x + h[7] * y + h[8] || 1e-12;
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/** Corners for a given slab thickness from the calibrated planes (nearest two, linear). */
export function cornersAt(dev: DeviceCal | null | undefined, thicknessIn: number): [Pt, Pt, Pt, Pt] | null {
  const planes = (dev?.planes ?? []).filter((p) => p?.corners?.length === 4).slice().sort((a, b) => a.thicknessIn - b.thicknessIn);
  if (!planes.length) return null;
  if (planes.length === 1) return planes[0].corners;
  // Two nearest by thickness (bracketing if possible).
  let lo = planes[0], hi = planes[planes.length - 1];
  for (let i = 0; i + 1 < planes.length; i++) if (thicknessIn >= planes[i].thicknessIn && thicknessIn <= planes[i + 1].thicknessIn) { lo = planes[i]; hi = planes[i + 1]; break; }
  if (thicknessIn < planes[0].thicknessIn) { lo = planes[0]; hi = planes[1]; }
  if (thicknessIn > planes[planes.length - 1].thicknessIn) { lo = planes[planes.length - 2]; hi = planes[planes.length - 1]; }
  const span = hi.thicknessIn - lo.thicknessIn || 1;
  const t = (thicknessIn - lo.thicknessIn) / span;
  return lo.corners.map((c, i) => [c[0] + (hi.corners[i][0] - c[0]) * t, c[1] + (hi.corners[i][1] - c[1]) * t] as Pt) as [Pt, Pt, Pt, Pt];
}

/** inches → projector px for a slab of this thickness (null if not calibrated). */
export function tableToScreen(cal: Calibration | null | undefined, thicknessIn: number): number[] | null {
  if (!cal?.projector) return null;
  const c = cornersAt(cal.projector, thicknessIn);
  return c ? solveHomography(refCorners(cal.refLengthIn, cal.refWidthIn), c) : null;
}
/** camera image px → inches on the top face of a slab of this thickness. */
export function imageToTable(cal: Calibration | null | undefined, thicknessIn: number): number[] | null {
  if (!cal?.camera) return null;
  const c = cornersAt(cal.camera, thicknessIn);
  return c ? solveHomography(c, refCorners(cal.refLengthIn, cal.refWidthIn)) : null;
}

/** Default projector corners: the reference rectangle fitted in the screen with a margin. */
export function fitCorners(L: number, W: number, w: number, h: number, margin = 60): [Pt, Pt, Pt, Pt] {
  const s = Math.min((w - 2 * margin) / L, (h - 2 * margin) / W);
  const iw = L * s, ih = W * s, x = (w - iw) / 2, y = (h - ih) / 2;
  return [[x, y], [x + iw, y], [x + iw, y + ih], [x, y + ih]];
}

/** Local scale (px per inch) of a homography around a point — for line widths and text. */
export function localScale(h: number[], p: Pt): number {
  const a = applyH(h, p), b = applyH(h, [p[0] + 1, p[1]]), c = applyH(h, [p[0], p[1] + 1]);
  return (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1])) / 2;
}

/** Axis-aligned bounds of a set of points. */
export function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
