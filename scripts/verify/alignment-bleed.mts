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

function short(by: number, edge: "ends" | "starts") {
  if (Math.abs(by) <= EDGE) {
    return `${edge} on it`;
  }

  return edge === "starts" ? `starts ${tenths(by)} inside it` : `ends ${tenths(by)} short of it`;
}

/**
 * The column's other half (craft E7, E1 across pieces): a top-level list, strip or row of marks
 * reaches its column's end, and where it doesn't, where it starts is said with it. Lists side by side share a band of the page and are
 * judged together, so two halves of the column pass and a lone half doesn't. Passing the column
 * is `bleedLeads`' to judge.
 */
export function spanLeads(context: Context): AlignmentFinding[] {
  const tops = context.capture.elements
    .filter((group) => group.part === "group" && group.column)
    .toSorted((one, other) => one.bounds[1] - other.bounds[1]);

  const bands: (typeof tops)[] = [];

  for (const group of tops) {
    const [, top] = group.bounds;

    const band = bands.find((open) =>
      open.some(
        (other) =>
          other.column?.join(" ") === group.column?.join(" ") &&
          top < other.bounds[1] + other.bounds[3],
      ),
    );

    if (band) {
      band.push(group);
    } else {
      bands.push([group]);
    }
  }

  return bands.flatMap((band) => {
    const [start = 0, end = 0] = band[0]?.column ?? [];
    const left = Math.min(...band.map(({ bounds: [x] }) => x));
    const right = Math.max(...band.map(({ bounds: [x, , width] }) => x + width));
    const inside = { end: end - right, start: left - start };

    // Set in from the start but reaching the end, a list sits beside something no piece declares
    // (the course page's timeline rail, a grid's first cell); stopping short of the end, it doesn't.
    if (inside.end <= EDGE) {
      return [];
    }

    return [
      finding(context, {
        detail: `${band.map((group) => group.name ?? group.id).join(", ")} ${short(inside.start, "starts")} and ${short(inside.end, "ends")}`,
        level: "fail",
        measured: Math.max(inside.start, inside.end),
        message: "a list or a strip stops short of the page's column",
        piece: "page",
        rule: "column",
      }),
    ];
  });
}
