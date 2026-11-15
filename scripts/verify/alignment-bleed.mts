import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, EDGE, finding, tenths } from "./alignment-geometry.mts";

/** Craft E7: a highlighted row passes its column by this much on each side, no more. */
const ROW_BLEED = 10;

function allowed(fill: CaptureElement, past: { end: number; start: number }) {
  const [frameStart = 0, frameEnd = 0] = fill.frame ?? [];
  const [x, , width] = fill.bounds;

  if (fill.kind === "highlight") {
    return (
      Math.abs(past.start - past.end) <= EDGE && Math.max(past.start, past.end) <= ROW_BLEED + EDGE
    );
  }

  // A hairline or a picture passes the column only by reaching the page's whole room.
  if (fill.kind === "hairline" || fill.kind === "picture") {
    return x <= frameStart + EDGE && x + width >= frameEnd - EDGE;
  }

  return false;
}

function side(by: number, edge: "ends" | "starts") {
  if (Math.abs(by) <= EDGE) {
    return `${edge} on it`;
  }

  return by > 0 ? `${edge} ${tenths(by)} past it` : `${edge} ${tenths(-by)} inside it`;
}

/**
 * Only three things pass the page's column (craft E7): a row in a highlighted state, by 10 px on
 * each side; a bar's or a section's hairline, across the page's whole room; and a full-bleed
 * picture. A static box, an underline that passes by a few pixels, or an uneven bleed fails.
 */
export function bleedLeads(context: Context): AlignmentFinding[] {
  return context.capture.elements.flatMap((fill) => {
    if (fill.part !== "fill" || !fill.column) {
      return [];
    }

    const [start, end] = fill.column;
    const [x, , width] = fill.bounds;
    const past = { end: x + width - end, start: start - x };

    if (allowed(fill, past)) {
      return [];
    }

    return [
      finding(context, {
        detail: `${fill.name ?? fill.id} ${side(past.start, "starts")} and ${side(past.end, "ends")}`,
        level: "fail",
        measured: Math.max(past.start, past.end),
        message: `a ${fill.kind ?? "box"} passes the page's column`,
        piece: "page",
        rule: "column",
      }),
    ];
  });
}
