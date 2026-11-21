import { type Decision } from "./decision-schema";
import { type verifiedClaims } from "./evidence";
import { caseRunKey } from "./identity";
import { type Comparison } from "./schemas";

type Row = Decision["rows"][number];
type Claims = ReturnType<typeof verifiedClaims>;
type Rules = NonNullable<Comparison["manifest"]["priorities"]["comparison"]>;
type Side = Row["side"];

function affectedRuns(row: Row, language: string, rules: Rules) {
  return new Set(
    row.quality
      .filter(
        (metric) =>
          metric.language === language &&
          (metric.check
            ? metric.criterion !== "answer keys"
            : rules.criteria[metric.criterion] === "counts"),
      )
      .flatMap((metric) => metric.affected.map(caseRunKey)),
  );
}

function tradeLimit({
  incumbent,
  challenger,
  trade,
}: {
  incumbent: Row["deliveryByLanguage"][string] | undefined;
  challenger: Row["deliveryByLanguage"][string] | undefined;
  trade: Rules["trade"];
}) {
  if (!trade || !incumbent || !challenger) {
    return 0;
  }

  const costShare =
    incumbent.costPer1000 && challenger.costPer1000 !== null
      ? (incumbent.costPer1000 - challenger.costPer1000) / incumbent.costPer1000
      : null;

  const seconds =
    incumbent.p95 !== null && challenger.p95 !== null ? incumbent.p95 - challenger.p95 : null;

  const savingsMeetTrade =
    (trade.saveCostShare !== null && costShare !== null && costShare >= trade.saveCostShare) ||
    (trade.saveSeconds !== null && seconds !== null && seconds >= trade.saveSeconds);

  return savingsMeetTrade ? trade.majorIncreasePer100 * incumbent.successful : 0;
}

function codeCheckPending(comparison: Comparison) {
  const name =
    comparison.manifest.codeCheck ??
    comparison.checks.find((check) => check.name !== "answer keys")?.name;

  if (!name) {
    return () => false;
  }

  const checked = new Set(
    comparison.checks
      .filter((check) => check.name === name)
      .map((check) => `${caseRunKey(check)}:${check.side}`),
  );

  return (key: string, side: Side) => !checked.has(`${key}:${side}`);
}

function runBounds({
  confirmedIncumbent,
  confirmedChallenger,
  claims,
  uncheckedIncumbent,
  uncheckedChallenger,
}: {
  confirmedIncumbent: boolean;
  confirmedChallenger: boolean;
  claims: Claims;
  uncheckedIncumbent: boolean;
  uncheckedChallenger: boolean;
}) {
  const incumbent = Number(confirmedIncumbent);
  const challenger = Number(confirmedChallenger);
  const current = challenger - incumbent;
  const both = claims.length > 0 ? 0 : current;

  const best =
    uncheckedIncumbent || claims.some((claim) => claim.side === "incumbent")
      ? challenger - 1
      : current;

  const worst =
    uncheckedChallenger || claims.some((claim) => claim.side === "challenger")
      ? 1 - incumbent
      : current;

  return {
    best: Math.min(best, both),
    current,
    decisive: claims.filter(
      (claim) =>
        (claim.side === "incumbent" ? !confirmedIncumbent : !confirmedChallenger) || current !== 0,
    ),
    unchecked:
      (uncheckedIncumbent && !confirmedIncumbent) || (uncheckedChallenger && !confirmedChallenger),
    worst: Math.max(worst, both),
  };
}

export function tradeBounds({
  cases,
  challenger,
  comparison,
  incumbent,
  pending,
  rules,
}: {
  cases: Decision["cases"];
  challenger: Row;
  comparison: Comparison;
  incumbent: Row;
  pending: Claims;
  rules: Rules;
}) {
  const languages = new Map(cases.map((item) => [item.caseId, item.language]));
  const unchecked = codeCheckPending(comparison);

  const bounds = [...new Set(languages.values())].map((language) => {
    const incumbentAffected = affectedRuns(incumbent, language, rules);
    const challengerAffected = affectedRuns(challenger, language, rules);

    const limit = tradeLimit({
      challenger: challenger.deliveryByLanguage[language],
      incumbent: incumbent.deliveryByLanguage[language],
      trade: rules.trade,
    });

    const runs = comparison.manifest.runsCompared
      .filter((run) => languages.get(run.caseId) === language)
      .map((run) => {
        const key = caseRunKey(run);

        return runBounds({
          claims: pending.filter(
            (claim) =>
              rules.criteria[claim.observation.criterion] === "counts" && caseRunKey(claim) === key,
          ),
          confirmedChallenger: challengerAffected.has(key),
          confirmedIncumbent: incumbentAffected.has(key),
          uncheckedChallenger: unchecked(key, "challenger"),
          uncheckedIncumbent: unchecked(key, "incumbent"),
        });
      });

    return {
      best: runs.reduce((sum, run) => sum + run.best, 0) * 100 > limit,
      current: runs.reduce((sum, run) => sum + run.current, 0) * 100 > limit,
      decisive: runs.flatMap((run) => run.decisive),
      language,
      unchecked: runs.some((run) => run.unchecked),
      worst: runs.reduce((sum, run) => sum + run.worst, 0) * 100 > limit,
    };
  });

  const best = bounds.find((bound) => bound.best);
  const current = bounds.find((bound) => bound.current);
  const worst = bounds.filter((bound) => bound.worst);

  const reason = (bound: typeof best) =>
    deficitReason(bound?.language, comparison.manifest.runs, rules.trade);

  return {
    best: reason(best),
    current: reason(current),
    decisive: best ? [] : worst.flatMap((bound) => bound.decisive),
    unchecked: worst.some((bound) => bound.unchecked),
    worst: reason(worst[0]),
  };
}

function deficitReason(language: string | undefined, runs: number, trade: Rules["trade"]) {
  if (!language) {
    return;
  }

  const unit = runs > 1 ? "runs" : "cases";

  return trade
    ? `The confirmed quality deficit exceeds the accepted trade in ${language}.`
    : `The challenger has more ${unit} with a confirmed major problem in ${language}.`;
}
