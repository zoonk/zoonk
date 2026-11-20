import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, type Group, notMeasured, rowName } from "./alignment-geometry.mts";

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

  const reasons = [...Map.groupBy(read.unreadable, (area) => area.reason ?? "no reason given")].map(
    ([reason, areas]) => `${areas.length} ${areas.length === 1 ? "area" : "areas"}: ${reason}`,
  );

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
    ...(reasons.length > 0
      ? [
          notMeasured(
            context,
            read,
            "unreadable",
            "an area of it the platform couldn't read",
            reasons.join("; "),
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
