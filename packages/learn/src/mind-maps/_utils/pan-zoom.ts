/** How far a picture is zoomed and moved from the middle of its frame, in screen pixels. */
export type PanZoom = { scale: number; x: number; y: number };

export type Frame = { height: number; width: number };
export type Point = { x: number; y: number };

export const FIT: PanZoom = { scale: 1, x: 0, y: 0 };

/** Small print reads at about four times the fitted size; further only blurs. */
export const MAX_SCALE = 5;

/** A tap of a zoom button, or a double tap, goes this far. */
export const ZOOM_STEP = 1.6;
export const DOUBLE_TAP_SCALE = 2.5;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The side of a square picture fitted inside the frame. */
export function fitSide(frame: Frame): number {
  return Math.max(0, Math.min(frame.width, frame.height));
}

/**
 * Keeps the zoom between fitted and the most that helps, and the picture over its frame: zoomed
 * in, it can be moved until its edge meets the frame's, never past it; fitted, it stays centered.
 */
export function clampPanZoom({ frame, view }: { frame: Frame; view: PanZoom }): PanZoom {
  const scale = clampNumber(view.scale, 1, MAX_SCALE);
  const side = fitSide(frame) * scale;
  const maxX = Math.max(0, (side - frame.width) / 2);
  const maxY = Math.max(0, (side - frame.height) / 2);

  return { scale, x: clampNumber(view.x, -maxX, maxX), y: clampNumber(view.y, -maxY, maxY) };
}

/**
 * Zooms to `scale` keeping the spot under `point` (from the frame's middle) where it is, as a
 * pinch or a double tap expects.
 */
export function zoomAt({
  frame,
  point,
  scale,
  view,
}: {
  frame: Frame;
  point: Point;
  scale: number;
  view: PanZoom;
}): PanZoom {
  const next = clampNumber(scale, 1, MAX_SCALE);
  const ratio = next / view.scale;

  return clampPanZoom({
    frame,
    view: {
      scale: next,
      x: point.x - (point.x - view.x) * ratio,
      y: point.y - (point.y - view.y) * ratio,
    },
  });
}

export function panBy({
  delta,
  frame,
  view,
}: {
  delta: Point;
  frame: Frame;
  view: PanZoom;
}): PanZoom {
  return clampPanZoom({ frame, view: { ...view, x: view.x + delta.x, y: view.y + delta.y } });
}
