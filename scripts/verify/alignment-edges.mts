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
  notMeasured,
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

/** A text's first line: as the capture gives it, or its ink's top line when it gives a line count. */
function firstLineOf(text: CaptureElement): Box | null {
  if (text.firstLine) {
    return box(text.firstLine);
  }

  const ink = drawn(text);
  return ink ? { ...ink, bottom: ink.top + (ink.bottom - ink.top) / (text.lines ?? 1) } : null;
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

/** Where a part's drawing ends: a learner sees ink, never a glyph's padding inside its box. */
function inkRight(element: CaptureElement) {
  return drawn(element)?.right ?? element.bounds[0] + element.bounds[2];
}

/**
 * One list, one end: a row's last drawn part (its end glyph, or its value where it has none) ends
 * on the group's end edge, by its ink. A row with no end glyph may instead keep the glyph's slot,
 * its value ending where the other rows' values end. And every value in the list ends on one edge,
 * so a row that drops the slot (its value at the end edge, the others' before their chevrons) fails
 * too. An end glyph whose ink wasn't measured (clipped) is left to the not-measured record.
 */
export function endLeads(context: Context, read: Group): AlignmentFinding[] {
  const { group, holders, parts, rows } = read;

  const edgeless = rows.filter((row) => {
    const own = parts.filter((element) => element.row === row.id);

    return (
      typeof (row.endEdge ?? group.endEdge) !== "number" &&
      own.some((element) => (element.part === "end" || element.part === "value") && drawn(element))
    );
  });

  const ending = rows.flatMap((row) => {
    const own = parts.filter((element) => element.row === row.id);
    const declared = row.endEdge ?? group.endEdge;
    const edge = typeof declared === "number" ? declared : undefined;
    const ends = own.filter((element) => element.part === "end" && drawn(element));

    // An end whose ink wasn't measured (clipped) leaves the row to its not-measured record.
    if (own.some((element) => element.part === "end" && element.ink === "not measured")) {
      return [];
    }

    const values = isStacked(row, own)
      ? []
      : own.filter((element) => element.part === "value" && drawn(element));

    const last = [...ends, ...values].toSorted((one, other) => inkRight(other) - inkRight(one))[0];

    if (!last || edge === undefined) {
      return [];
    }

    const valueEnd = values
      .map((element) => inkRight(element))
      .toSorted((one, other) => other - one)[0];

    return [{ edge, hasEnd: ends.length > 0, last: inkRight(last), row, valueEnd }];
  });

  const valueColumns = ending.flatMap(({ hasEnd, valueEnd }) =>
    hasEnd && valueEnd !== undefined ? [valueEnd] : [],
  );

  const short = ending.flatMap(({ edge, hasEnd, last, row }) => {
    const off = edge - last;

    if (Math.abs(off) <= EDGE) {
      return [];
    }

    if (!hasEnd && valueColumns.some((column) => Math.abs(column - last) <= EDGE)) {
      return [];
    }

    const rowBox = box(row.bounds);

    const holder =
      off > 0
        ? holderNamed(
            holders.filter((element) => element.row === row.id),
            { ...rowBox, left: last - EDGE, right: edge + EDGE },
          )
        : undefined;

    return [
      finding(context, {
        detail: `${rowName(read, row.id)} ends at ${tenths(last)}, the edge is at ${tenths(edge)}`,
        level: "fail",
        measured: off,
        message: `a row of ${groupName(read)} ends ${off > 0 ? "short of" : "past"} the group's end edge`,
        piece: group.piece,
        rule: "end-edge",
        ...(holder ? { holder } : {}),
      }),
    ];
  });

  const values = ending.flatMap(({ row, valueEnd }) =>
    valueEnd === undefined ? [] : [{ row, valueEnd }],
  );

  const column = oneEdge(values, ({ valueEnd }) => valueEnd);

  return [
    ...(edgeless.length > 0
      ? [
          notMeasured(
            context,
            read,
            "end-edge",
            "a row's end edge wasn't measured",
            edgeless.map((row) => rowName(read, row.id)).join(", "),
          ),
        ]
      : []),
    ...short,
    ...(column
      ? [
          finding(context, {
            detail: `${column.odd.map(({ row }) => rowName(read, row.id)).join(", ")} end at ${column.odd.map(({ valueEnd }) => tenths(valueEnd)).join(", ")} where ${column.shared} of ${values.length} values end at ${tenths(column.common)}`,
            level: "fail",
            measured: Math.max(
              ...column.odd.map(({ valueEnd }) => Math.abs(valueEnd - column.common)),
            ),
            message: `the values of ${groupName(read)} don't end on one edge`,
            piece: group.piece,
            rule: "end-edge",
          }),
        ]
      : []),
  ];
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

  const pairs = rows.slice(1).flatMap((next, index) => {
    const previous = rows[index];

    // Rows of one flow only: the web names each row's flow; a platform that doesn't has one.
    if (
      !previous ||
      previous.flow !== next.flow ||
      next.bounds[1] < previous.bounds[1] + previous.bounds[3] - EDGE
    ) {
      return [];
    }

    return [{ gap: next.gapBefore ?? group.gap, next, previous }];
  });

  const unread = pairs.filter(({ gap }) => typeof gap !== "number");

  const off = pairs.flatMap(({ gap, next, previous }) => {
    if (typeof gap !== "number") {
      return [];
    }

    const above = box(previous.bounds);
    const below = box(next.bounds);
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

  return [
    ...(unread.length > 0
      ? [
          notMeasured(
            context,
            read,
            "gap",
            "the gap between two neighbors wasn't measured",
            unread
              .map(
                ({ next, previous }) =>
                  `${rowName(read, previous.id)} and ${rowName(read, next.id)}`,
              )
              .join(", "),
          ),
        ]
      : []),
    ...off,
  ];
}
