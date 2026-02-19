export function calculateBoardFeet(
  lengthIn: number,
  widthIn: number,
  heightIn: number,
  tolerancePct: number = 0
): number {
  const l = lengthIn * (1 + tolerancePct / 100);
  const w = widthIn * (1 + tolerancePct / 100);
  const h = heightIn * (1 + tolerancePct / 100);
  return (l * w * h) / 144;
}

export function calculateDacronSqFt(
  lengthIn: number,
  widthIn: number,
  heightIn: number,
  tolerancePct: number = 0
): number {
  const l = lengthIn * (1 + tolerancePct / 100);
  const w = widthIn * (1 + tolerancePct / 100);
  const h = heightIn * (1 + tolerancePct / 100);
  // Dacron wraps the cushion: top + bottom + 2 sides
  const topBottom = 2 * l * w;
  const sides = 2 * (l + w) * h;
  return (topBottom + sides) / 144; // convert sq inches to sq ft
}
