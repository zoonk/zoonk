import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import {
  type Box,
  type Context,
  EDGE,
  type Group,
  box,
  drawn,
  finding,
  groupName,
  holderNamed,
  rowName,
  tenths,
} from "./alignment-geometry.mts";

/**
 * Whether measured positions share one edge (all within one unit of each other), and if not, the
 * position most of them agree with and the ones off it. Positions are compared as measured;
 * rounding is for printing only, so 1.3 apart fails and 0.8 apart passes.
 */
function oneEdge<Item>(items: Item[], at: (item: Item) => number) {
  const values = items.map((item) => at(item));

  if (values.length < 2 || Math.max(...values) - Math.min(...values) <= EDGE) {
    return null;
  }

  const near = (value: number) => values.filter((other) => Math.abs(other - value) <= EDGE).length;
  const common = values.toSorted((one, other) => near(other) - near(one))[0] ?? 0;
  const off = items.filter((item) => Math.abs(at(item) - common) > EDGE);

  const odd =
    off.length > 0
      ? off
      : items
          .toSorted((one, other) => Math.abs(at(other) - common) - Math.abs(at(one) - common))
          .slice(0, 1);

  return { common, odd, shared: items.length - odd.length };
}

/** Labels, or leads, of one group start on one edge: read by the first line's drawn start. */
export function startLeads(
  context: Context,
  read: Group,
  part: "label" | "lead",
): AlignmentFinding[] {
  const { group, holders, parts, rows } = read;

  const starts = parts
    .filter((element) => element.part === part && drawn(element))
    .map((element) => ({ element, start: element.firstLine?.[0] ?? drawn(element)?.left ?? 0 }));

  // The first label of each row is the one its row starts with.
  const firsts = [...Map.groupBy(starts, ({ element }) => element.row).values()].flatMap(
    (here) =>
      here.toSorted((one, other) => one.element.bounds[1] - other.element.bounds[1])[0] ?? [],
  );

  const edge = oneEdge(firsts, ({ start }) => start);

  if (!edge) {
    return [];
  }

  const { common, odd, shared } = edge;

  const held = odd
    .map(({ element, start }) => {
      const row = rows.find((candidate) => candidate.id === element.row);
      const rowBox = row ? box(row.bounds) : null;

      return rowBox && start > common
        ? holderNamed(
            holders.filter((holder) => holder.row === element.row),
            { ...rowBox, left: common - EDGE, right: start + EDGE },
          )
        : undefined;
    })
    .find(Boolean);

  const rule = part === "label" ? "label-start" : "lead-start";

  return [
    finding(context, {
      detail: `${odd.map(({ element }) => rowName(read, element.row)).join(", ")} at ${odd.map(({ start }) => tenths(start)).join(", ")} where ${shared} of ${firsts.length} start at ${tenths(common)}`,
      level: "fail",
      measured: Math.max(...odd.map(({ start }) => Math.abs(start - common))),
      message: `the ${part}s of ${groupName(read)} don't start on one edge`,
      piece: group.piece,
      rule,
      ...(held ? { holder: held } : {}),
    }),
  ];
}

/** Every drawn mark of a group has its center on one vertical axis. */
export function axisLeads(context: Context, read: Group): AlignmentFinding[] {
  const { group, parts } = read;

  const marks = parts
    .filter((element) => element.part === "mark" && drawn(element))
    .map((element) => ({ center: element.bounds[0] + element.bounds[2] / 2, element }));

  const axis = oneEdge(marks, ({ center }) => center);

  if (!axis) {
    return [];
  }

  const { common, odd } = axis;

  return [
    finding(context, {
      detail: `${odd.map(({ element }) => rowName(read, element.row)).join(", ")} centered at ${odd.map(({ center }) => tenths(center)).join(", ")} where the others are at ${tenths(common)}`,
      level: "fail",
      measured: Math.max(...odd.map(({ center }) => Math.abs(center - common))),
      message: `the marks of ${groupName(read)} aren't on one axis`,
      piece: group.piece,
      rule: "mark-axis",
    }),
  ];
}

/**
 * Where an end glyph or control meets the edge: by its ink or by its box, whichever is nearer.
 * Platforms keep a glyph's padding differently (the web pulls the ink onto the edge, Material keeps
 * it inside a box that sits on the edge), and either way the slot is on the edge. A value meets it
 * by its ink: a slot with nothing drawn in it holds room, it doesn't reach the edge.
 */
function reach(element: CaptureElement, edge: number) {
  const ink = drawn(element)?.right ?? element.bounds[0] + element.bounds[2];

  if (element.part !== "end") {
    return ink;
  }

  const frame = element.bounds[0] + element.bounds[2];
  return Math.abs(edge - frame) < Math.abs(edge - ink) ? frame : ink;
}

/** A text's first line: as the capture gives it, or its ink's top line when it gives a line count. */
function firstLineOf(text: CaptureElement): Box | null {
  if (text.firstLine) {
    return box(text.firstLine);
  }

  const ink = drawn(text);
  return ink ? { ...ink, bottom: ink.top + (ink.bottom - ink.top) / (text.lines ?? 1) } : null;
}

function rightOf(element: CaptureElement) {
  return drawn(element)?.right ?? element.bounds[0] + element.bounds[2];
}

/** The row's value went under its label (large text): its value no longer ends the row. */
export function isStacked(row: CaptureElement, own: CaptureElement[]) {
  if (row.stacked !== undefined) {
    return row.stacked;
  }

  const label = own.find((element) => element.part === "label");
  const line = label ? firstLineOf(label) : null;
  const value = own.find((element) => element.part === "value" && drawn(element));
  const ink = value ? drawn(value) : null;
  return Boolean(line && ink && ink.top >= line.bottom - EDGE);
}

/**
 * A row with a value beside its label or an end mark: its last drawn part ends on the end edge. A
 * row with no end mark may instead end its value where the rows with one end theirs (the chevron's
 * kept slot, `ListRowChevronSpace`).
 */
export function endLeads(context: Context, read: Group): AlignmentFinding[] {
  const { group, holders, parts, rows } = read;

  const ending = rows.flatMap((row) => {
    const own = parts.filter((element) => element.row === row.id);
    const declared = row.endEdge ?? group.endEdge;
    const edge = typeof declared === "number" ? declared : undefined;
    // An end clipped under a bar still has its slot on the edge: its box stands in for its ink.
    const ends = own.filter(
      (element) => element.part === "end" && (drawn(element) || element.ink === "not measured"),
    );

    const values = isStacked(row, own)
      ? []
      : own.filter((element) => element.part === "value" && drawn(element));

    const last = [...ends, ...values].toSorted((one, other) => rightOf(other) - rightOf(one))[0];

    if (!last || edge === undefined) {
      return [];
    }

    const valueEnd = values
      .map((element) => drawn(element)?.right ?? 0)
      .toSorted((one, other) => other - one)[0];

    return [{ edge, hasEnd: ends.length > 0, last: reach(last, edge), row, valueEnd }];
  });

  const valueColumns = ending.flatMap(({ hasEnd, valueEnd }) =>
    hasEnd && valueEnd !== undefined ? [valueEnd] : [],
  );

  return ending.flatMap(({ edge, hasEnd, last, row }) => {
    const short = edge - last;

    if (Math.abs(short) <= EDGE) {
      return [];
    }

    if (!hasEnd && valueColumns.some((column) => Math.abs(column - last) <= EDGE)) {
      return [];
    }

    const rowBox = box(row.bounds);

    const holder =
      short > 0
        ? holderNamed(
            holders.filter((element) => element.row === row.id),
            { ...rowBox, left: last - EDGE, right: edge + EDGE },
          )
        : undefined;

    return [
      finding(context, {
        detail: `${rowName(read, row.id)} ends at ${tenths(last)}, the edge is at ${tenths(edge)}`,
        level: "fail",
        measured: short,
        message: `a row of ${groupName(read)} ends ${short > 0 ? "short of" : "past"} the group's end edge`,
        piece: group.piece,
        rule: "end-edge",
        ...(holder ? { holder } : {}),
      }),
    ];
  });
}

/** A value stacked under its label (large text) starts on the label's start edge. */
export function stackedLeads(context: Context, read: Group): AlignmentFinding[] {
  const { group, parts, rows } = read;

  const off = rows.flatMap((row) => {
    const own = parts.filter((element) => element.row === row.id);
    const label = own.find((element) => element.part === "label");
    const value = own.find((element) => element.part === "value" && drawn(element));
    const start = label?.firstLine?.[0] ?? (label ? drawn(label)?.left : undefined);
    const valueStart = value ? drawn(value)?.left : undefined;

    if (!isStacked(row, own) || start === undefined || valueStart === undefined) {
      return [];
    }

    return Math.abs(valueStart - start) > EDGE ? [{ off: valueStart - start, row }] : [];
  });

  if (off.length === 0) {
    return [];
  }

  return [
    finding(context, {
      detail: off.map(({ off: by, row }) => `${rowName(read, row.id)} ${tenths(by)}`).join(", "),
      level: "fail",
      measured: Math.max(...off.map(({ off: by }) => Math.abs(by))),
      message: `a value stacked under its label in ${groupName(read)} doesn't start on the label's edge`,
      piece: group.piece,
      rule: "label-start",
    }),
  ];
}

/** Two drawn neighbors in one flow are the gap their layout declares apart, margins included. */
export function gapLeads(context: Context, read: Group): AlignmentFinding[] {
  const { group, holders } = read;

  // A part placed in the group itself (a status line's note) is a neighbor as a row is.
  const rows = [...read.rows, ...read.parts.filter((part) => part.row === null)].toSorted(
    (one, other) => one.bounds[1] - other.bounds[1],
  );

  if (
    group.gap === "not measured" &&
    rows.length > 1 &&
    rows.every((row) => row.gapBefore === undefined)
  ) {
    return [
      finding(context, {
        detail: groupName(read),
        level: "not-measured",
        message: `the gap of a ${group.piece} wasn't measured`,
        piece: group.piece,
        rule: "gap",
      }),
    ];
  }

  return rows.slice(1).flatMap((next, index) => {
    const previous = rows[index];

    // Rows of one flow only: the web names each row's flow; a platform that doesn't has one.
    if (!previous || previous.flow !== next.flow) {
      return [];
    }

    const above = box(previous.bounds);
    const below = box(next.bounds);

    if (below.top < above.bottom - EDGE) {
      return [];
    }

    const gap = next.gapBefore ?? group.gap;

    // A gap the platform couldn't read prints once as not measured, below.
    if (typeof gap !== "number") {
      return [];
    }

    const expected = gap + (previous.margins?.[1] ?? 0) + (next.margins?.[0] ?? 0);

    const measured = below.top - above.bottom;

    if (Math.abs(measured - expected) <= EDGE) {
      return [];
    }

    const holder = holderNamed(holders, {
      bottom: below.top,
      left: Math.min(above.left, below.left),
      right: Math.max(above.right, below.right),
      top: above.bottom,
    });

    return [
      finding(context, {
        detail: `${rowName(read, previous.id)} and ${rowName(read, next.id)} are ${tenths(measured)} apart where the layout puts ${tenths(expected)}`,
        level: "fail",
        measured: measured - expected,
        message: `two neighbors in ${groupName(read)} aren't the group's gap apart`,
        piece: group.piece,
        rule: "gap",
        ...(holder ? { holder } : {}),
      }),
    ];
  });
}
