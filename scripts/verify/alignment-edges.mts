import { type AlignmentFinding } from "./alignment-capture.mts";
import {
  type Context,
  EDGE,
  type Group,
  box,
  drawn,
  finding,
  groupName,
  holderNamed,
  overlapsVertically,
  rowName,
  tenths,
} from "./alignment-geometry.mts";

/** Labels, or leads, of one group start on one edge: read by the first line's drawn start. */
export function startLeads(
  context: Context,
  { group, holders, parts, rows }: Group,
  part: "label" | "lead",
): AlignmentFinding[] {
  const starts = parts
    .filter((element) => element.part === part && drawn(element))
    .map((element) => ({ element, start: element.firstLine?.[0] ?? drawn(element)?.left ?? 0 }));

  // The first label of each row is the one its row starts with.
  const firsts = [...Map.groupBy(starts, ({ element }) => element.row).values()].flatMap(
    (here) =>
      here.toSorted((one, other) => one.element.bounds[1] - other.element.bounds[1])[0] ?? [],
  );

  if (firsts.length < 2) {
    return [];
  }

  const low = Math.min(...firsts.map(({ start }) => start));
  const high = Math.max(...firsts.map(({ start }) => start));

  if (high - low <= EDGE) {
    return [];
  }

  const edges = [...Map.groupBy(firsts, ({ start }) => Math.round(start))].toSorted(
    ([, one], [, other]) => other.length - one.length,
  );

  const [common] = edges[0] ?? [low];
  const odd = edges.slice(1).flatMap(([, here]) => here);

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
      detail: `${odd.map(({ element }) => rowName(rows, element.row)).join(", ")} at ${odd.map(({ start }) => tenths(start)).join(", ")} where ${edges[0]?.[1].length ?? 0} of ${firsts.length} start at ${common}`,
      level: "fail",
      measured: Math.max(...odd.map(({ start }) => Math.abs(start - common))),
      message: `the ${part}s of ${groupName(group)} don't start on one edge`,
      piece: group.piece,
      rule,
      ...(held ? { holder: held } : {}),
    }),
  ];
}

/** Every drawn mark of a group has its center on one vertical axis. */
export function axisLeads(context: Context, { group, parts, rows }: Group): AlignmentFinding[] {
  const marks = parts
    .filter((element) => element.part === "mark" && drawn(element))
    .map((element) => ({ center: element.bounds[0] + element.bounds[2] / 2, element }));

  if (marks.length < 2) {
    return [];
  }

  const axes = [...Map.groupBy(marks, ({ center }) => Math.round(center))].toSorted(
    ([, one], [, other]) => other.length - one.length,
  );

  const [common] = axes[0] ?? [0];
  const odd = marks.filter(({ center }) => Math.abs(center - common) > EDGE);

  if (odd.length === 0) {
    return [];
  }

  return [
    finding(context, {
      detail: `${odd.map(({ element }) => rowName(rows, element.row)).join(", ")} centered at ${odd.map(({ center }) => tenths(center)).join(", ")} where the others are at ${common}`,
      level: "fail",
      measured: Math.max(...odd.map(({ center }) => Math.abs(center - common))),
      message: `the marks of ${groupName(group)} aren't on one axis`,
      piece: group.piece,
      rule: "mark-axis",
    }),
  ];
}

/**
 * A row with a value beside its label or an end mark: its last drawn part ends on the end edge. A
 * row with no end mark may instead end its value where the rows with one end theirs (the chevron's
 * kept slot, `ListRowChevronSpace`).
 */
export function endLeads(
  context: Context,
  { group, holders, parts, rows }: Group,
): AlignmentFinding[] {
  const ending = rows.flatMap((row) => {
    const own = parts.filter((element) => element.row === row.id);
    const label = own.find((element) => element.part === "label");
    const line = label?.firstLine ? box(label.firstLine) : null;
    const ends = own.filter((element) => element.part === "end" && drawn(element));

    const values = own.filter((element) => {
      const ink = drawn(element);
      return element.part === "value" && ink && (!line || overlapsVertically(ink, line));
    });

    const last = [...ends, ...values]
      .map((element) => drawn(element)?.right ?? 0)
      .toSorted((one, other) => other - one)[0];

    const valueEnd = values
      .map((element) => drawn(element)?.right ?? 0)
      .toSorted((one, other) => other - one)[0];

    return last === undefined ? [] : [{ hasEnd: ends.length > 0, last, row, valueEnd }];
  });

  const valueColumns = ending.flatMap(({ hasEnd, valueEnd }) =>
    hasEnd && valueEnd !== undefined ? [valueEnd] : [],
  );

  return ending.flatMap(({ hasEnd, last, row }) => {
    const edge = row.endEdge ?? group.endEdge ?? last;
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
        detail: `${row.name ?? row.id} ends at ${tenths(last)}, the edge is at ${tenths(edge)}`,
        level: "fail",
        measured: short,
        message: `a row of ${groupName(group)} ends ${short > 0 ? "short of" : "past"} the group's end edge`,
        piece: group.piece,
        rule: "end-edge",
        ...(holder ? { holder } : {}),
      }),
    ];
  });
}

/** Two drawn neighbors in one flow are the gap their layout declares apart, margins included. */
export function gapLeads(context: Context, { group, holders, rows }: Group): AlignmentFinding[] {
  return rows.slice(1).flatMap((next, index) => {
    const previous = rows[index];

    if (!previous || previous.flow !== next.flow) {
      return [];
    }

    const above = box(previous.bounds);
    const below = box(next.bounds);

    if (below.top < above.bottom - EDGE) {
      return [];
    }

    const expected =
      (next.gapBefore ?? 0) + (previous.margins?.[1] ?? 0) + (next.margins?.[0] ?? 0);

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
        detail: `${previous.name ?? previous.id} and ${next.name ?? next.id} are ${tenths(measured)} apart where the layout puts ${tenths(expected)}`,
        level: "fail",
        measured: measured - expected,
        message: `two neighbors in ${groupName(group)} aren't the group's gap apart`,
        piece: group.piece,
        rule: "gap",
        ...(holder ? { holder } : {}),
      }),
    ];
  });
}
