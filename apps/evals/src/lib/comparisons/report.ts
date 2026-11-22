import {
  familyLabel,
  languageName,
  preferenceLeanLabel,
} from "@/app/tasks/[taskId]/comparisons/_utils/labels";
import { uncheckedAnswerKeys } from "./decision";
import { type Decision } from "./decision-schema";
import { type Comparison } from "./schemas";

export function formatDecision(decision: Decision, comparison: Comparison) {
  const { manifest } = comparison;
  const showRun = manifest.runs > 1;

  return [
    `## ${decision.outcome}\n\n${decision.reason}`,
    "| Variant | Cases by language | Successful / attempted | Missing pairs | Wins / losses / ties / unresolved | Weighted majors by language | USD / 1,000 | p50 / p95 seconds | Status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...decision.rows.map(
      (row) =>
        `| ${manifest.variants[row.side]?.model} | ${JSON.stringify(row.casesByLanguage)} | ${row.succeeded} / ${row.attempted} | ${row.missingMatches} | ${row.wins} / ${row.losses} / ${row.ties} / ${row.unresolved} | ${JSON.stringify(row.weightedMajorsByLanguage)} | ${row.costPer1000?.toFixed(4) ?? "unknown"} | ${row.p50?.toFixed(2) ?? "unknown"} / ${row.p95?.toFixed(2) ?? "unknown"} | ${row.status} |`,
    ),
    ...(decision.preferences.length > 0 ? ["", "### Readers preferred"] : []),
    ...decision.preferences.flatMap((row) => [
      "",
      `**${row.label}**`,
      ...preferenceLines(row),
      ...row.byLanguage.flatMap((language) => [
        "",
        languageName(language.language),
        ...preferenceLines(language),
      ]),
    ]),
    "",
    ...decision.rows.flatMap((row) =>
      row.quality.map(
        (item) =>
          `${row.side}, ${item.language}, ${item.criterion}: ${item.affected.length} major-affected ${showRun ? "runs" : "cases"} (${item.both.length} on both).${
            item.weight && item.weight > 1
              ? ` These count as ${item.affected.length * item.weight} at weight ${item.weight}.`
              : ""
          }${
            item.ownerAffected
              ? ` Owner findings: ${item.ownerAffected
                  .map(({ caseId, run }) => (showRun ? `${caseId} (run ${run})` : caseId))
                  .join(", ")}.`
              : ""
          }`,
      ),
    ),
    "",
    ...decision.cases.map(
      (item) =>
        `${item.language} [${item.caseId}](/tasks/${manifest.taskId}/comparisons/${manifest.id}#${encodeURIComponent(item.caseId)}): ${item.result}; families ${JSON.stringify(item.votes)}; owner ${item.owner ?? "unread"}.${
          item.adjudication
            ? ` Owner ruling after seeing the evidence: ${item.adjudication.direction}. ${item.adjudication.reason}`
            : ""
        }`,
    ),
    ...decision.readers.map(
      (reader) =>
        `${reader.model}: own-family preference ${reader.ownWins}/${reader.ownOpportunities}, owner agreement ${reader.ownerAgrees}/${reader.ownerCompared}, failed packets ${reader.failedPackets}.`,
    ),
    ...comparison.checks.map(
      (check) => `${check.caseId}-${check.run} ${check.side} ${check.name}: ${checkText(check)}`,
    ),
    ...uncheckedAnswerKeys(comparison).map(
      ({ caseId, run, side }) => `${caseId}-${run} ${side} answer keys: unchecked.`,
    ),
    `Delivery sample frozen ${manifest.date}.\n`,
  ].join("\n");
}

type PreferenceRow = Decision["preferences"][number];

function preferenceText({ challenger, incumbent, tie }: PreferenceRow["total"]) {
  return `Current ${incumbent} · Challenger ${challenger} · Tie ${tie}`;
}

function preferenceLines({
  families,
  lean,
  total,
}: Pick<PreferenceRow, "families" | "lean" | "total">) {
  return [
    preferenceText(total),
    ...(lean ? [preferenceLeanLabel(lean)] : []),
    ...families.map((family) => `- ${familyLabel(family.family)} · ${preferenceText(family)}`),
  ];
}

function checkText(check: Comparison["checks"][number]) {
  if (check.name === "answer keys" && check.total === 0 && check.passed === 0) {
    return "none to check.";
  }

  const blocking = check.blockingProblems?.length
    ? ` Blocks saving: ${check.blockingProblems.join(" ")}`
    : "";

  return `${check.passed}/${check.total}. ${check.problems.join(" ")}${blocking}`;
}
