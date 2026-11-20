import { meetsLatencyBudget, summarizeLatency } from "../latency";
import { type caseVotes, opposite, sides, type verifiedClaims } from "./evidence";
import { type Comparison } from "./schemas";

export function deliveryTable(
  comparison: Comparison,
  cases: ReturnType<typeof caseVotes>,
  claims: ReturnType<typeof verifiedClaims>,
) {
  const { manifest } = comparison;
  const rules = manifest.priorities.comparison;
  const languages = [...new Set(cases.map((item) => item.language))];

  const missing = manifest.runsCompared.filter(
    (record) => (Boolean(manifest.variants.incumbent) && !record.incumbent) || !record.challenger,
  ).length;

  return sides
    .filter((subject) => manifest.variants[subject])
    .map((subject) => {
      const slots = manifest.runsCompared.flatMap((record) =>
        record[subject] ? [record[subject]] : [],
      );

      const failures = manifest.runsCompared.flatMap((record) =>
        record.failures.filter((failure) => failure.side === subject),
      );

      const languagesByCase = new Map(cases.map((item) => [item.caseId, item.language]));

      const delivery = measureDelivery(
        manifest.runsCompared,
        subject,
        Boolean(manifest.variants.incumbent),
      );

      const deliveryByLanguage = Object.fromEntries(
        languages.map((language) => {
          const measured = manifest.runsCompared.filter(
            (run) => languagesByCase.get(run.caseId) === language,
          );

          return [
            language,
            measureDelivery(measured, subject, Boolean(manifest.variants.incumbent)),
          ];
        }),
      );

      const quality = languages.flatMap((language) =>
        manifest.criteria.map(({ id: criterion }) => {
          const relevant = claims.filter(
            (claim) =>
              cases.some((item) => item.caseId === claim.caseId && item.language === language) &&
              claim.observation.criterion === criterion,
          );

          const onSide = (value: typeof subject) => [
            ...new Set(
              relevant
                .filter(
                  (claim) =>
                    claim.finding === "holds for both" ||
                    (claim.finding === "holds" && claim.side === value),
                )
                .map((claim) => claim.caseId),
            ),
          ];

          const affected = onSide(subject);
          const other = new Set(onSide(opposite(subject)));

          const ownerAffected = [
            ...new Set(
              relevant
                .filter((claim) => claim.source === "owner" && claim.side === subject)
                .map((claim) => claim.caseId),
            ),
          ];

          return {
            affected,
            both: affected.filter((caseId) => other.has(caseId)),
            criterion,
            language,
            ...(ownerAffected.length > 0 && { ownerAffected }),
          };
        }),
      );

      const disqualified =
        quality.some(
          (qualityRow) =>
            qualityRow.affected.length > 0 &&
            rules?.criteria[qualityRow.criterion] === "disqualifies",
        ) ||
        comparison.checks.some(
          (ch) => ch.side === subject && ch.name === "answer keys" && ch.passed < ch.total,
        ) ||
        failures.some((failure) => failure.reason === "schema") ||
        (slots.length > 0 &&
          meetsLatencyBudget({ budget: manifest.latencyBudget ?? undefined, latency: delivery }) ===
            false);

      return {
        attempted: slots.length + failures.length,
        casesByLanguage: Object.fromEntries(
          languages.map((languageCode) => [
            languageCode,
            cases.filter((item) => item.language === languageCode).length,
          ]),
        ),
        costPer1000: delivery.costPer1000,
        date: manifest.date,
        deliveryByLanguage,
        losses: cases.filter((item) => item.result === opposite(subject)).length,
        missingMatches: missing,
        p50: delivery.p50,
        p95: delivery.p95,
        quality,
        side: subject,
        status: disqualified ? ("disqualified" as const) : ("eligible" as const),
        succeeded: slots.length,
        ties: cases.filter((item) => item.result === "tie").length,
        unresolved: cases.filter((item) => item.result === "unresolved").length,
        wins: cases.filter((item) => item.result === subject).length,
      };
    });
}

function measureDelivery(
  runs: Comparison["manifest"]["runsCompared"],
  subject: (typeof sides)[number],
  paired: boolean,
) {
  const matched = runs
    .filter((run) => run.challenger && (!paired || run.incumbent))
    .flatMap((run) => (run[subject] ? [run[subject]] : []));

  const failedCost = runs
    .flatMap((run) => run.failures.filter((failure) => failure.side === subject))
    .reduce((sum, fail) => sum + fail.costUsd, 0);

  const cost = matched.reduce((sum, slot) => sum + slot.costUsd, failedCost);
  const latency = summarizeLatency(matched.map((slot) => slot.durationMs));

  return {
    costPer1000: matched.length > 0 ? (cost * 1000) / matched.length : null,
    p50: matched.length > 0 ? latency.p50 : null,
    p95: matched.length > 0 ? latency.p95 : null,
    successful: matched.length,
  };
}
