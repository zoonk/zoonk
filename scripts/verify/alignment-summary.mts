import { type AlignmentFinding, type Level } from "./alignment-capture.mts";

export type Summary = {
  unresolved: number;
  /** Null until the scenario list (slice 4) says which were required. */
  scenariosMissing: number | null;
  discovery: number;
  /** What a declared piece promised and the read couldn't measure: it fails, never passes. */
  notMeasured: number;
  failed: boolean;
};

/** One fault is one line, however many screens and rows it showed on. */
function faultKey(item: AlignmentFinding) {
  return `${item.level} ${item.rule} ${item.message}`;
}

export function summarize(
  findings: AlignmentFinding[],
  scenariosMissing: number | null = null,
): Summary {
  const faults = (keep: (item: AlignmentFinding) => boolean) =>
    new Set(findings.filter((item) => keep(item)).map((item) => faultKey(item))).size;

  const unresolved = faults((item) => item.level === "fail" && !item.exception);
  const notMeasured = faults((item) => item.level === "not-measured");

  return {
    discovery: faults((item) => item.level === "discovery"),
    failed: unresolved > 0 || notMeasured > 0 || (scenariosMissing ?? 0) > 0,
    notMeasured,
    scenariosMissing,
    unresolved,
  };
}

export function summaryLine(summary: Summary) {
  const scenarios =
    summary.scenariosMissing === null
      ? "scenarios not listed yet"
      : `${summary.scenariosMissing} required scenario${summary.scenariosMissing === 1 ? "" : "s"} missing`;

  return `${summary.failed ? "FAIL" : "PASS"}: ${summary.unresolved} unresolved; ${scenarios}; ${summary.discovery} discovery leads; ${summary.notMeasured} not measured`;
}

const LEVEL_TITLES: Record<Level, string> = {
  discovery: "Discovery leads (never failing)",
  fail: "Failing: declared relationships",
  "not-measured": "Not measured",
};

/** Each fault once, its instances under it. */
const LISTED = 3;

/** One place's instances on one line: what each showed, the measured range, what holds the room. */
function instanceText(items: AlignmentFinding[]) {
  const details = [...new Set(items.map((item) => item.detail).filter(Boolean))];
  const more = details.length > LISTED ? ` and ${details.length - LISTED} more` : "";
  const measured = items.flatMap((item) => (item.measured === undefined ? [] : [item.measured]));
  const low = Math.min(...measured);
  const high = Math.max(...measured);

  const range =
    measured.length === 0
      ? ""
      : ` [${low === high ? low : `${low}–${high}`} ${items[0]?.unit ?? ""}]`;

  const holder = items.find((item) => item.holder)?.holder;

  return `${details.length > 0 ? `: ${details.slice(0, LISTED).join("; ")}${more}` : ""}${range.replace(/ \]$/u, "]")}${holder ? `; ${holder}` : ""}`;
}

export function alignmentLines(findings: AlignmentFinding[]): string[] {
  return (["fail", "discovery", "not-measured"] as const).flatMap((level) => {
    const faults = [
      ...Map.groupBy(
        findings.filter((item) => item.level === level),
        (item) => faultKey(item),
      ).values(),
    ];

    if (faults.length === 0) {
      return [];
    }

    return [
      `### ${LEVEL_TITLES[level]}`,
      "",
      ...faults.flatMap((instances) => {
        const [first] = instances;

        if (!first) {
          return [];
        }

        const places = Map.groupBy(
          instances,
          (item) =>
            `${item.screen}${item.scenario ? ` [${item.scenario}]` : ""} · ${item.configuration}`,
        );

        return [
          `- **${first.rule}**: ${first.message}${first.exception ? ` (excepted: ${first.exception})` : ""}`,
          ...[...places].map(([place, here]) => `  - ${place}${instanceText(here)}`),
        ];
      }),
      "",
    ];
  });
}
