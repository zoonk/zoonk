import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, type Group, finding, groupName, rowName } from "./alignment-geometry.mts";

/**
 * What a declared piece promised and the read couldn't measure. An unmeasured relationship is
 * never a pass: each gap in the inputs is a not-measured record, and it fails the run like a
 * broken relationship, since the piece's declaration says these parts are there.
 */
function notMeasured(context: Context, read: Group, rule: string, what: string, detail: string) {
  return finding(context, {
    detail,
    level: "not-measured",
    message: `${groupName(read)}: ${what}`,
    piece: read.group.piece,
    rule,
  });
}

/** Rows side by side (a grid, two columns) aren't one stack, which start, end and gap assume. */
export function isOneStack({ rows }: Group) {
  return rows.every((row, index) => {
    const next = rows[index + 1];
    return !next || next.bounds[1] >= row.bounds[1] + row.bounds[3] / 2;
  });
}

const LABELLED = ["label-start", "line", "type"];
const STACKED = ["end-edge", "gap", "label-start", "lead-start", "mark-axis"];

export function coverageLeads(
  context: Context,
  read: Group,
  relations: Set<string>,
): AlignmentFinding[] {
  const { parts, rows } = read;

  if (rows.length === 0) {
    return [
      notMeasured(
        context,
        read,
        "rows",
        "no rows the read could find",
        "the group draws, but nothing in it matched its rows",
      ),
    ];
  }

  const label = (row: CaptureElement) =>
    parts.find((part) => part.row === row.id && part.part === "label" && Array.isArray(part.ink));

  const unlabelled = [...LABELLED].some((relation) => relations.has(relation))
    ? rows.filter((row) => !label(row))
    : [];

  const unread = parts.filter((part) => part.ink === "not measured");
  const stackless = !isOneStack(read) && STACKED.some((relation) => relations.has(relation));

  return [
    ...(unlabelled.length > 0
      ? [
          notMeasured(
            context,
            read,
            "label",
            "a row's label wasn't found",
            unlabelled.map((row) => rowName(read, row.id)).join(", "),
          ),
        ]
      : []),
    ...(unread.length > 0
      ? [
          notMeasured(
            context,
            read,
            "ink",
            "a part's drawing wasn't measured",
            unread.map((part) => `the ${part.part} of ${rowName(read, part.row)}`).join(", "),
          ),
        ]
      : []),
    ...(stackless
      ? [
          notMeasured(
            context,
            read,
            "stack",
            "its rows aren't one stack, which start, end and gap assume",
            `${rows.length} rows side by side`,
          ),
        ]
      : []),
  ];
}
