import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, EDGE, box, finding, tenths } from "./alignment-geometry.mts";

/** Controls this close side by side are one row: the kit spaces a row's controls 8 to 12 apart. */
const ROW_GAP = 24;

/** Side by side on one surface, each one's middle within the other's height, and close. */
function beside(one: CaptureElement, other: CaptureElement) {
  const a = box(one.bounds);
  const b = box(other.bounds);
  const middle = (at: typeof a) => (at.top + at.bottom) / 2;
  const gap = Math.max(b.left - a.right, a.left - b.right);

  return (
    one.surface === other.surface &&
    middle(a) >= b.top &&
    middle(a) <= b.bottom &&
    middle(b) >= a.top &&
    middle(b) <= a.bottom &&
    gap >= -EDGE &&
    gap <= ROW_GAP
  );
}

/** Rows of controls: each control joins every row it sits beside, so a row is read whole. */
function rowsOf(controls: CaptureElement[]): CaptureElement[][] {
  const rows: CaptureElement[][] = [];

  for (const control of controls) {
    const joined = rows.filter((row) => row.some((other) => beside(control, other)));
    const merged = [...joined.flat(), control];
    rows.splice(0, rows.length, ...rows.filter((row) => !joined.includes(row)), merged);
  }

  return rows;
}

/** Controls in one row share a height (craft: one of `Button`'s heights, as tall as a field beside). */
export function heightLeads(context: Context): AlignmentFinding[] {
  const controls = context.capture.elements.filter((element) => element.part === "control");

  return rowsOf(controls).flatMap((row) => {
    const heights = row.map((control) => control.bounds[3]);

    if (Math.max(...heights) - Math.min(...heights) <= EDGE) {
      return [];
    }

    const ordered = row.toSorted((one, other) => one.bounds[0] - other.bounds[0]);

    return [
      finding(context, {
        detail: ordered
          .map((control) => `${control.name ?? control.id} ${tenths(control.bounds[3])}`)
          .join(", "),
        level: "fail",
        measured: Math.max(...heights) - Math.min(...heights),
        message: "controls in one row have more than one height",
        piece: "page",
        rule: "one-height",
      }),
    ];
  });
}
