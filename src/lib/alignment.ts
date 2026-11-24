// All positions are fractions of the visible page. The capture distance stays
// constant in screen pixels as the user zooms.
export interface AlignmentBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function alignmentTargets(boxes: AlignmentBox[]) {
  const x = [0.5, 0, 1];
  const y = [0.5, 0, 1];
  for (const box of boxes) {
    x.push(box.x, box.x + box.width / 2, box.x + box.width);
    y.push(box.y, box.y + box.height / 2, box.y + box.height);
  }
  return { x, y };
}

export function alignAxis(position: number, size: number, targets: number[], pixels: number, min: number, max: number) {
  const origin = Math.max(min, Math.min(max, position));
  let result = origin;
  let guide: number | undefined;
  let closest = 5 / pixels;
  for (const target of targets) {
    for (const offset of [0, size / 2, size]) {
      const candidate = target - offset;
      const distance = Math.abs(candidate - origin);
      if (distance < closest && candidate >= min && candidate <= max) {
        result = candidate;
        guide = target;
        closest = distance;
      }
    }
  }
  return { position: result, guide };
}
