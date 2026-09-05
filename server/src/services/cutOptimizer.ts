/**
 * 2D rectangle packing of foam pieces onto stock slabs, one plan per foam
 * (thickness/grade). Guillotine "shelf" packing with rotation, largest pieces
 * first, then a best-fit pass into leftover shelf space. Good enough for a
 * shop cut list; the goal is fewer slabs and a printable layout, not optimality.
 */
export interface CutPiece {
  label: string; // "400-30 Seat core"
  l: number;
  w: number;
  qty: number;
}
export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number; // along sheet length (x)
  h: number; // along sheet width (y)
  rotated: boolean;
}
export interface Sheet {
  index: number;
  pieces: PlacedPiece[];
  usedArea: number;
  utilization: number; // 0..1
}
export interface CutPlan {
  sheetLength: number;
  sheetWidth: number;
  sheets: Sheet[];
  pieceCount: number;
  unplaced: { label: string; l: number; w: number }[];
  utilization: number;
}

interface Shelf {
  y: number;
  height: number;
  x: number; // next free x
}

export function packPieces(pieces: CutPiece[], sheetLength: number, sheetWidth: number, kerf = 0.25): CutPlan {
  const items: { label: string; l: number; w: number }[] = [];
  for (const p of pieces) for (let i = 0; i < Math.max(1, Math.round(p.qty)); i++) items.push({ label: p.label, l: p.l, w: p.w });
  // Largest area first, ties by the longer side.
  items.sort((a, b) => b.l * b.w - a.l * a.w || Math.max(b.l, b.w) - Math.max(a.l, a.w));

  const sheets: Sheet[] = [];
  const shelvesBySheet: Shelf[][] = [];
  const unplaced: { label: string; l: number; w: number }[] = [];

  const fitsSheet = (l: number, w: number) => (l <= sheetLength && w <= sheetWidth) || (w <= sheetLength && l <= sheetWidth);

  function tryPlace(sheetIdx: number, it: { label: string; l: number; w: number }): boolean {
    const shelves = shelvesBySheet[sheetIdx];
    const sheet = sheets[sheetIdx];
    // 1. Existing shelves, either orientation, must fit shelf height.
    for (const s of shelves) {
      for (const [pw, ph, rot] of [
        [it.l, it.w, false],
        [it.w, it.l, true],
      ] as [number, number, boolean][]) {
        if (ph <= s.height && s.x + pw <= sheetLength) {
          sheet.pieces.push({ label: it.label, x: s.x, y: s.y, w: pw, h: ph, rotated: rot });
          s.x += pw + kerf;
          sheet.usedArea += pw * ph;
          return true;
        }
      }
    }
    // 2. New shelf: prefer the orientation with the smaller height (keeps shelves tight).
    const last = shelves[shelves.length - 1];
    const nextY = last ? last.y + last.height + kerf : 0;
    const orientations = ([
      [it.l, it.w, false],
      [it.w, it.l, true],
    ] as [number, number, boolean][]).sort((a, b) => a[1] - b[1]);
    for (const [pw, ph, rot] of orientations) {
      if (pw <= sheetLength && nextY + ph <= sheetWidth) {
        shelves.push({ y: nextY, height: ph, x: pw + kerf });
        sheet.pieces.push({ label: it.label, x: 0, y: nextY, w: pw, h: ph, rotated: rot });
        sheet.usedArea += pw * ph;
        return true;
      }
    }
    return false;
  }

  for (const it of items) {
    if (!fitsSheet(it.l, it.w)) {
      unplaced.push(it);
      continue;
    }
    let placed = false;
    for (let i = 0; i < sheets.length && !placed; i++) placed = tryPlace(i, it);
    if (!placed) {
      sheets.push({ index: sheets.length + 1, pieces: [], usedArea: 0, utilization: 0 });
      shelvesBySheet.push([]);
      placed = tryPlace(sheets.length - 1, it);
      if (!placed) unplaced.push(it);
    }
  }
  const sheetArea = sheetLength * sheetWidth;
  for (const s of sheets) s.utilization = sheetArea ? s.usedArea / sheetArea : 0;
  const totalUsed = sheets.reduce((a, s) => a + s.usedArea, 0);
  return {
    sheetLength,
    sheetWidth,
    sheets,
    pieceCount: items.length - unplaced.length,
    unplaced,
    utilization: sheets.length ? totalUsed / (sheets.length * sheetArea) : 0,
  };
}
