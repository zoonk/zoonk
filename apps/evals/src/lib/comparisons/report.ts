import { type Decision } from "./decision-schema";
import { type Comparison } from "./schemas";

export function formatDecision(decision: Decision, comparison: Comparison) {
  const { manifest } = comparison;

  return [
    `## ${decision.outcome}\n\n${decision.reason}`,
    "| Variant | Cases by language | Successful / attempted | Missing pairs | Wins / losses / ties / unresolved | USD / 1,000 | p50 / p95 seconds | Status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...decision.rows.map(
      (row) =>
        `| ${manifest.variants[row.side]?.model} | ${JSON.stringify(row.casesByLanguage)} | ${row.succeeded} / ${row.attempted} | ${row.missingMatches} | ${row.wins} / ${row.losses} / ${row.ties} / ${row.unresolved} | ${row.costPer1000?.toFixed(4) ?? "unknown"} | ${row.p50?.toFixed(2) ?? "unknown"} / ${row.p95?.toFixed(2) ?? "unknown"} | ${row.status} |`,
    ),
    "",
    ...decision.rows.flatMap((row) =>
      row.quality.map(
        (item) =>
          `${row.side}, ${item.language}, ${item.criterion}: ${item.affected.length} major-affected cases (${item.both.length} on both).`,
      ),
    ),
    "",
    ...decision.cases.map(
      (item) =>
        `${item.language} [${item.caseId}](/tasks/${manifest.taskId}/comparisons/${manifest.id}#${encodeURIComponent(item.caseId)}): ${item.result}; families ${JSON.stringify(item.votes)}; owner ${item.owner ?? "unread"}.`,
    ),
    ...decision.readers.map(
      (reader) =>
        `${reader.model}: own-family preference ${reader.ownWins}/${reader.ownOpportunities}, owner agreement ${reader.ownerAgrees}/${reader.ownerCompared}, failed packets ${reader.failedPackets}.`,
    ),
    ...comparison.checks.map(
      (check) =>
        `${check.caseId}-${check.run} ${check.side} ${check.name}: ${check.passed}/${check.total}. ${check.problems.join(" ")}`,
    ),
    `Delivery sample frozen ${manifest.date}.\n`,
  ].join("\n");
}
