import { type AlignmentFinding, type Level } from "./alignment-capture.mts";

/** What the web's read can't see, said wherever its results print: the CLI's help and a report. */
export const READ_LIMITS = [
  "The read doesn't enter iframes or shadow roots. Of what a pseudo-element draws it reads only a row's `::before` highlight and a top or bottom rule (for `column`); a part drawn only by `::before` or `::after` otherwise isn't checked. A rule is clipped by its ancestors' `overflow`, not by a `clip-path`, which no screen sets on one.",
  "A fill is judged as a highlight only on a row that says it's highlighted (`aria-current`, `data-highlighted`, `aria-selected`): a hover or focus fill isn't drawn while the read runs, so it isn't judged.",
  "It counts a filled action only when the kit's button variants draw it (`--button-variant`), so a control filled some other way isn't counted; a disabled one doesn't, since it isn't a choice the learner has yet. Two filled buttons with the same `data-action-name` count as one action: the name is the author's statement that they are one, and the check trusts it.",
  "Line endings and lone words require lineTexts, control heights require control records, and clipping requires cut records from the newer probe. Older captures report those four relationships as not measured and fail the summary.",
  "A text in a script with no capitals (Japanese, Korean) is set on its ideographic face, the box of a full-frame glyph in the same fonts, not on its own ink. Nothing listed here isn't proof those were checked.",
].join(" ");

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

  // A missing scenario counts in its own clause, not as an unresolved finding.
  const unresolved = faults(
    (item) => item.level === "fail" && !item.exception && item.rule !== "scenario",
  );

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
function instanceText(items: AlignmentFinding[], listed = LISTED) {
  const details = [...new Set(items.map((item) => item.detail).filter(Boolean))];
  const more = details.length > listed ? ` and ${details.length - listed} more` : "";
  const measured = items.flatMap((item) => (item.measured === undefined ? [] : [item.measured]));
  const low = Math.min(...measured);
  const high = Math.max(...measured);

  const range =
    measured.length === 0
      ? ""
      : ` [${low === high ? low : `${low}–${high}`} ${items[0]?.unit ?? ""}]`;

  const holder = items.find((item) => item.holder)?.holder;

  return `${details.length > 0 ? `: ${details.slice(0, listed).join("; ")}${more}` : ""}${range.replace(/ \]$/u, "]")}${holder ? `; ${holder}` : ""}`;
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
            `${item.screen}${item.scenario ? ` [${item.scenario}]` : ""} · ${item.configuration}${item.source ? ` · ${item.source}` : ""}`,
        );

        const count =
          level === "not-measured"
            ? ` (${instances.length} ${instances.length === 1 ? "group" : "groups"})`
            : "";

        return [
          `- **${first.rule}**: ${first.message}${count}${first.exception ? ` (excepted: ${first.exception})` : ""}`,
          // What wasn't measured lists every row: it is the list a platform's lane works down.
          ...[...places].map(
            ([place, here]) =>
              `  - ${place}${instanceText(here, level === "not-measured" ? here.length : LISTED)}`,
          ),
        ];
      }),
      "",
    ];
  });
}
