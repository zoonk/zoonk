import { type AlignmentFinding, type Level } from "./alignment-capture.mts";

export type Summary = {
  unresolved: number;
  /** Null until the scenario list (slice 4) says which were required. */
  scenariosMissing: number | null;
  discovery: number;
  notMeasured: number;
};

/** One fault is one line, however many screens and rows it showed on. */
function faultKey(item: AlignmentFinding) {
  return `${item.level} ${item.rule} ${item.message}`;
}

export function summarize(
  findings: AlignmentFinding[],
  scenariosMissing: number | null = null,
): Summary {
  const faults = (level: Level, unresolvedOnly = false) =>
    new Set(
      findings
        .filter((item) => item.level === level && !(unresolvedOnly && item.exception))
        .map((item) => faultKey(item)),
    ).size;

  return {
    discovery: faults("discovery"),
    notMeasured: faults("not-measured"),
    scenariosMissing,
    unresolved: faults("fail", true),
  };
}

export function failed(summary: Summary) {
  return summary.unresolved > 0 || (summary.scenariosMissing ?? 0) > 0;
}

export function summaryLine(summary: Summary) {
  const scenarios =
    summary.scenariosMissing === null
      ? "scenarios not listed yet"
      : `${summary.scenariosMissing} required scenario${summary.scenariosMissing === 1 ? "" : "s"} missing`;

  return `${failed(summary) ? "FAIL" : "PASS"}: ${summary.unresolved} unresolved; ${scenarios}; ${summary.discovery} discovery leads; ${summary.notMeasured} not measured`;
}

const LEVEL_TITLES: Record<Level, string> = {
  discovery: "Discovery leads (never failing)",
  fail: "Failing: declared relationships",
  "not-measured": "Not measured",
};

/** Each fault once, its instances under it. */
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

        const unique = [
          ...new Map(
            instances.map((item) => [`${item.screen} ${item.configuration} ${item.detail}`, item]),
          ).values(),
        ];

        return [
          `- **${first.rule}**: ${first.message}${first.exception ? ` (excepted: ${first.exception})` : ""}`,
          ...unique.map(
            (item) =>
              `  - ${item.scenario ?? item.screen} · ${item.configuration}: ${item.detail}${item.measured === undefined ? "" : ` [${item.measured} ${item.unit ?? ""}]`.trimEnd()}${item.holder ? `; ${item.holder}` : ""}`,
          ),
        ];
      }),
      "",
    ];
  });
}
