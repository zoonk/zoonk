import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, EDGE, finding, tenths } from "./alignment-geometry.mts";

/**
 * Craft E7: a highlighted row passes its column by the kit's 10 on each side, no more. The kit's
 * lengths are in rem, so with larger text the bleed grows with it.
 */
const ROW_BLEED = 10;

function allowed(fill: CaptureElement, past: { end: number; start: number }, textScale: number) {
  const bleed = ROW_BLEED * textScale;
  const [frameStart = 0, frameEnd = 0] = fill.frame ?? [];
  const [x, , width] = fill.bounds;

  // A highlighted row, and the hairline between rows, which stays straight with them.
  const even =
    Math.abs(past.start - past.end) <= EDGE && Math.max(past.start, past.end) <= bleed + EDGE;

  if (fill.kind === "highlight" || (fill.kind === "hairline" && even)) {
    return even;
  }

  // The current tab's fill reaches past the column like a highlighted row, on the side it reaches
  // (craft's Deliberate choices), so the first tab's label starts on the title's edge.
  if (fill.kind === "tab") {
    return Math.max(past.start, past.end) <= bleed + EDGE;
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
 * Only four things pass the page's column (craft E7 and its Deliberate choices): a row in a
 * highlighted state, and a hairline between rows, by the kit's 10 on each side; the current tab's
 * fill, by the same 10 on the side it reaches; a bar's or a section's hairline, across the page's
 * whole room; and a full-bleed picture. A static box, an underline that passes by a few pixels, or an uneven bleed fails.
 */
/** Hairlines that touch in one line (a grid's tiles each drawing its part) are the line they draw. */
function joinLines(fills: CaptureElement[]): CaptureElement[] {
  const lines = fills
    .filter((fill) => fill.kind === "hairline")
    .toSorted((one, other) => one.bounds[1] - other.bounds[1] || one.bounds[0] - other.bounds[0]);

  const joined: CaptureElement[] = [];

  for (const line of lines) {
    const last = joined.at(-1);
    const [x, y, width, height] = line.bounds;

    if (
      last &&
      last.column?.join(" ") === line.column?.join(" ") &&
      Math.abs(last.bounds[1] - y) <= EDGE &&
      Math.abs(last.bounds[3] - height) <= EDGE &&
      x <= last.bounds[0] + last.bounds[2] + EDGE
    ) {
      const right = Math.max(last.bounds[0] + last.bounds[2], x + width);

      joined[joined.length - 1] = {
        ...last,
        bounds: [last.bounds[0], y, right - last.bounds[0], height],
      };
    } else {
      joined.push(line);
    }
  }

  return [...fills.filter((fill) => fill.kind !== "hairline"), ...joined];
}

export function bleedLeads(context: Context): AlignmentFinding[] {
  const fills = context.capture.elements.filter((fill) => fill.part === "fill" && fill.column);

  return joinLines(fills).flatMap((fill) => {
    if (!fill.column) {
      return [];
    }

    const [start, end] = fill.column;
    const [x, , width] = fill.bounds;
    const past = { end: x + width - end, start: start - x };

    if (fill.hangEdges?.length) {
      const off = Math.max(...fill.hangEdges.map((edge) => Math.abs(past[edge])));

      return off <= EDGE
        ? []
        : [
            finding(context, {
              detail: `${fill.name ?? fill.id}: its ink ${side(past.start, "starts")} and ${side(past.end, "ends")}`,
              level: "fail",
              measured: off,
              message: "a hanging control's ink misses the column edge",
              piece: "page",
              rule: "column",
            }),
          ];
    }

    if (allowed(fill, past, context.capture.configuration.textScale)) {
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
