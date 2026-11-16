import {
  LABEL_CLEARANCE,
  type LabelAnchor,
  type LabelBox,
  type LabelPoint,
  touchesSegment,
} from "../_utils/drawing-label";

const TAIL_RISE = 14;

export function distributionTailBottom({
  anchor,
  at,
  curve,
  obstacles,
  plot,
  preferred,
  size,
}: {
  anchor: Exclude<LabelAnchor, "middle">;
  at: number;
  curve: readonly LabelPoint[];
  obstacles: readonly LabelBox[];
  plot: LabelBox;
  preferred: number;
  size: { height: number; width: number };
}): number | undefined {
  if (size.width === 0 || size.height === 0) {
    return undefined;
  }

  const left = anchor === "start" ? at : at - size.width;

  return [preferred, plot.bottom - TAIL_RISE].find((candidate) => {
    const box = { bottom: candidate, left, right: left + size.width, top: candidate - size.height };

    const inside =
      box.left - LABEL_CLEARANCE >= plot.left &&
      box.right + LABEL_CLEARANCE <= plot.right &&
      box.top - LABEL_CLEARANCE >= plot.top &&
      box.bottom + LABEL_CLEARANCE <= plot.bottom;

    const clear = obstacles.every(
      (obstacle) =>
        Math.max(
          box.left - obstacle.right,
          obstacle.left - box.right,
          box.top - obstacle.bottom,
          obstacle.top - box.bottom,
        ) >= LABEL_CLEARANCE,
    );

    const touchesCurve = curve.some((point, index) => {
      const next = curve[index + 1];
      return next !== undefined && touchesSegment(box, { from: point, to: next });
    });

    return inside && clear && !touchesCurve;
  });
}
