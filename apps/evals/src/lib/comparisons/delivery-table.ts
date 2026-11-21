import { meetsLatencyBudget, summarizeLatency } from "../latency";
import { type Decision } from "./decision-schema";
import { type caseVotes, opposite, sides, type verifiedClaims } from "./evidence";
import { caseRunKey } from "./identity";
import { type Comparison } from "./schemas";

type Quality = Decision["rows"][number]["quality"];

function affectedRuns(runs: Quality[number]["affected"]) {
  return new Map(runs.map(({ caseId, run }) => [caseRunKey({ caseId, run }), { caseId, run }]));
}

export function deliveryTable(
  comparison: Comparison,
  cases: ReturnType<typeof caseVotes>,
  claims: ReturnType<typeof verifiedClaims>,
) {
  const { manifest } = comparison;
  const rules = manifest.priorities.comparison;
  const languages = [...new Set(cases.map((item) => item.language))];
  const failedChecks = comparison.checks.filter((check) => check.passed < check.total);

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

      const quality: Quality = languages.flatMap((language) => [
        ...manifest.criteria.map(({ id: criterion }) => {
          const relevant = claims.filter(
            (claim) =>
              cases.some((item) => item.caseId === claim.caseId && item.language === language) &&
              claim.observation.criterion === criterion,
          );

          const onSide = (value: typeof subject) =>
            affectedRuns(
              relevant.filter(
                (claim) =>
                  claim.finding === "holds for both" ||
                  (claim.finding === "holds" && claim.side === value),
              ),
            );

          const affected = [...onSide(subject).values()];
          const other = onSide(opposite(subject));

          const ownerAffected = [
            ...affectedRuns(
              relevant.filter((claim) => claim.source === "owner" && claim.side === subject),
            ).values(),
          ];

          return {
            affected,
            both: affected.filter((run) => other.has(caseRunKey(run))),
            criterion,
            language,
            ...(ownerAffected.length > 0 && { ownerAffected }),
          };
        }),
        ...checkFailures({
          checks: failedChecks.filter((check) => languagesByCase.get(check.caseId) === language),
          language,
          subject,
        }),
      ]);

      const disqualified =
        quality.some(
          (qualityRow) =>
            qualityRow.affected.length > 0 &&
            !qualityRow.check &&
            rules?.criteria[qualityRow.criterion] === "disqualifies",
        ) ||
        failedChecks.some((check) => check.side === subject && check.name === "answer keys") ||
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

function checkFailures({
  checks,
  language,
  subject,
}: {
  checks: Comparison["checks"];
  language: string;
  subject: (typeof sides)[number];
}) {
  return [...new Set(checks.map((check) => check.name))].map((name) => {
    const onSide = (side: typeof subject) =>
      affectedRuns(checks.filter((check) => check.name === name && check.side === side));

    const affected = [...onSide(subject).values()];
    const other = onSide(opposite(subject));

    return {
      affected,
      both: affected.filter((run) => other.has(caseRunKey(run))),
      check: true as const,
      criterion: name,
      language,
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
