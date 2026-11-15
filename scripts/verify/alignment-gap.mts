import { type AlignmentFinding } from "./alignment-capture.mts";
import {
  type Context,
  EDGE,
  type Group,
  box,
  finding,
  groupName,
  holderNamed,
  measured,
  notMeasured,
  rowName,
  tenths,
} from "./alignment-geometry.mts";

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

    return [{ gap: measured(next.gapBefore, measured(group.gap)), next, previous }];
  });

  const unread = pairs.filter(({ gap }) => gap === null);

  const off = pairs.flatMap(({ gap, next, previous }) => {
    if (gap === null) {
      return [];
    }

    const above = box(previous.bounds);
    const below = box(next.bounds);
    const expected = gap + (previous.margins?.[1] ?? 0) + (next.margins?.[0] ?? 0);

    const apart = below.top - above.bottom;

    if (Math.abs(apart - expected) <= EDGE) {
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
        detail: `${rowName(read, previous.id)} and ${rowName(read, next.id)} are ${tenths(apart)} apart where the layout puts ${tenths(expected)}`,
        level: "fail",
        measured: apart - expected,
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
