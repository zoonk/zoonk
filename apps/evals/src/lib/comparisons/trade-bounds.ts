import { checkCriteria, criterionWeight } from "./check-policy";
import { type Decision } from "./decision-schema";
import { weightedAffectedRuns } from "./delivery-table";
import { type verifiedClaims } from "./evidence";
import { caseRunKey } from "./identity";
import { type Comparison } from "./schemas";

type Row = Decision["rows"][number];
type Claims = ReturnType<typeof verifiedClaims>;
type Rules = NonNullable<Comparison["manifest"]["priorities"]["comparison"]>;
type Side = Row["side"];
type Delivery = Row["deliveryByLanguage"][string];

export function meetsWaitSaving(incumbent: Delivery, challenger: Delivery, seconds: number | null) {
  return (
    seconds !== null &&
    incumbent.p50 !== null &&
    challenger.p50 !== null &&
    incumbent.p50 - challenger.p50 >= seconds
  );
}

function tradeLimit({
  incumbent,
  challenger,
  trade,
}: {
  incumbent: Delivery;
  challenger: Delivery;
  trade: Rules["trade"];
}) {
  if (!trade) {
    return 0;
  }

  const costShare =
    incumbent.costPer1000 && challenger.costPer1000 !== null
      ? (incumbent.costPer1000 - challenger.costPer1000) / incumbent.costPer1000
      : null;

  const savingsMeetTrade =
    (trade.saveCostShare !== null && costShare !== null && costShare >= trade.saveCostShare) ||
    meetsWaitSaving(incumbent, challenger, trade.saveSeconds);

  return savingsMeetTrade ? trade.majorIncreasePer100 : 0;
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
  challenger,
  claims,
  incumbent,
  pendingChallengerCheck,
  pendingIncumbentCheck,
  rules,
}: {
  challenger: number;
  claims: Claims;
  incumbent: number;
  pendingChallengerCheck: number;
  pendingIncumbentCheck: number;
  rules: Rules;
}) {
  const weight = (claim: Claims[number]) =>
    criterionWeight(rules, claim.observation.criterion) ?? 0;

  const maximum = (side: Side, confirmed: number, pendingCheck: number) =>
    Math.max(
      confirmed,
      pendingCheck,
      ...claims.filter((claim) => claim.side === side).map((claim) => weight(claim)),
    );

  const maxIncumbent = maximum("incumbent", incumbent, pendingIncumbentCheck);
  const maxChallenger = maximum("challenger", challenger, pendingChallengerCheck);
  const current = challenger - incumbent;

  // A verifier can find the flaw in both outputs, even when the reader named only one.
  const best = Math.min(
    challenger - maxIncumbent,
    ...claims.map(
      (claim) => Math.max(challenger, weight(claim)) - Math.max(maxIncumbent, weight(claim)),
    ),
  );

  const worst = Math.max(
    maxChallenger - incumbent,
    ...claims.map(
      (claim) => Math.max(maxChallenger, weight(claim)) - Math.max(incumbent, weight(claim)),
    ),
  );

  return {
    best,
    current,
    decisive: claims.filter((claim) => weight(claim) > Math.min(incumbent, challenger)),
    unchecked: pendingChallengerCheck > challenger || pendingIncumbentCheck > incumbent,
    worst,
  };
}

export function tradeBounds({
  cases,
  challenger,
  comparison,
  incumbent,
  pending,
  rules,
  uncheckedKeys,
}: {
  cases: Decision["cases"];
  challenger: Row;
  comparison: Comparison;
  incumbent: Row;
  pending: Claims;
  rules: Rules;
  uncheckedKeys: { caseId: string; run: number; side: Side }[];
}) {
  const languages = new Map(cases.map((item) => [item.caseId, item.language]));
  const unchecked = codeCheckPending(comparison);
  const uncheckedKeySet = new Set(uncheckedKeys.map((slot) => `${caseRunKey(slot)}:${slot.side}`));
  const taskId = comparison.manifest.taskId;

  const codeWeight = Math.max(
    1,
    ...checkCriteria(taskId, comparison.manifest.codeCheck ?? "code checks").map(
      (criterion) => criterionWeight(rules, criterion) ?? 0,
    ),
  );

  const bounds = [...new Set(languages.values())].flatMap((language) => {
    const incumbentDelivery = incumbent.deliveryByLanguage[language];
    const challengerDelivery = challenger.deliveryByLanguage[language];

    if (!incumbentDelivery || !challengerDelivery) {
      return [];
    }

    const incumbentAffected = weightedAffectedRuns(incumbent.quality, language);
    const challengerAffected = weightedAffectedRuns(challenger.quality, language);

    const limit = tradeLimit({
      challenger: challengerDelivery,
      incumbent: incumbentDelivery,
      trade: rules.trade,
    });

    const runs = comparison.manifest.runsCompared
      .filter((run) => run.incumbent && run.challenger && languages.get(run.caseId) === language)
      .map((run) => {
        const key = caseRunKey(run);

        const pendingCheck = (side: Side) =>
          Math.max(
            unchecked(key, side) ? codeWeight : 0,
            uncheckedKeySet.has(`${key}:${side}`) ? 3 : 0,
          );

        return runBounds({
          challenger: challengerAffected.get(key) ?? 0,
          claims: pending.filter(
            (claim) =>
              rules.criteria[claim.observation.criterion] === "counts" && caseRunKey(claim) === key,
          ),
          incumbent: incumbentAffected.get(key) ?? 0,
          pendingChallengerCheck: pendingCheck("challenger"),
          pendingIncumbentCheck: pendingCheck("incumbent"),
          rules,
        });
      });

    const excessPer100 = (bound: "best" | "current" | "worst") =>
      runs.length > 0 ? (runs.reduce((sum, run) => sum + run[bound], 0) * 100) / runs.length : 0;

    return [
      {
        best: excessPer100("best"),
        current: excessPer100("current"),
        decisive: runs.flatMap((run) => run.decisive),
        language,
        limit,
        unchecked: runs.some((run) => run.unchecked),
        worst: excessPer100("worst"),
      },
    ];
  });

  const best = bounds.find((bound) => bound.best > bound.limit);
  const current = bounds.find((bound) => bound.current > bound.limit);
  const worst = bounds.filter((bound) => bound.worst > bound.limit);

  const unit = comparison.manifest.runs > 1 ? "runs" : "cases";

  const reason = (bound: typeof best, kind: "best" | "current" | "worst") =>
    bound &&
    `In ${bound.language}, the challenger adds ${Number(bound[kind].toFixed(2))} weighted major-affected ${unit} per 100 matched. The trade allows ${bound.limit}.`;

  return {
    best: reason(best, "best"),
    current: reason(current, "current"),
    decisive: best ? [] : worst.flatMap((bound) => bound.decisive),
    unchecked: worst.some((bound) => bound.unchecked),
    worst: reason(worst[0], "worst"),
  };
}
