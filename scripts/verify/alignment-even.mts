import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, EDGE, type Group, finding, rowName, tenths } from "./alignment-geometry.mts";

/** Rows that share a band of the group: each overlaps the band's first row from top to bottom. */
function bands(rows: CaptureElement[]): CaptureElement[][] {
  const sorted = rows.toSorted((one, other) => one.bounds[1] - other.bounds[1]);

  return sorted.reduce<CaptureElement[][]>((found, row) => {
    const [, top, , height] = row.bounds;

    const band = found.findIndex(([first]) => {
      const [, firstTop, , firstHeight] = first?.bounds ?? [0, 0, 0, 0];
      return top < firstTop + firstHeight && firstTop < top + height;
    });

    return band === -1
      ? [...found, [row]]
      : found.map((rowsOf, index) => (index === band ? [...rowsOf, row] : rowsOf));
  }, []);
}

function off(by: number, more: string, less: string) {
  return Math.abs(by) > EDGE ? [`${tenths(Math.abs(by))} ${by > 0 ? more : less}`] : [];
}

/**
 * Siblings of one kind side by side (craft E6's last sentence) share a top and a height, so a tile
 * or a tab that starts lower or stands taller than the first one beside it fails.
 */
export function evenLeads(context: Context, read: Group): AlignmentFinding[] {
  return bands(read.rows).flatMap(([first, ...beside]) => {
    if (!first) {
      return [];
    }

    const [, top, , height] = first.bounds;

    return beside.flatMap((row) => {
      const lower = row.bounds[1] - top;
      const taller = row.bounds[3] - height;

      const misses = [
        ...off(lower, "lower", "higher").map((by) => `starts ${by}`),
        ...off(taller, "taller", "shorter").map((by) => `is ${by}`),
      ];

      if (misses.length === 0) {
        return [];
      }

      return [
        finding(context, {
          detail: `${rowName(read, row.id)} ${misses.join(" and ")} than ${rowName(read, first.id)} beside it`,
          level: "fail",
          measured: Math.max(Math.abs(lower), Math.abs(taller)),
          message: `siblings side by side in ${read.group.piece} don't share a top and a height`,
          piece: read.group.piece,
          rule: "even",
        }),
      ];
    });
  });
}
