import { type Decision, type Direction, decisionSchema } from "./decision-schema";
import { deliveryTable } from "./delivery-table";
import {
  acceptedReads,
  canAdjudicate,
  caseVotes,
  missingReaderFamilies,
  needsBlindOwnerRead,
  readerPreferences,
  readerRecords,
  settle,
  sides,
  verifiedClaims,
} from "./evidence";
import { type Comparison } from "./schemas";
import { meetsWaitSaving, tradeBounds } from "./trade-bounds";

export { decisionSchema, type Decision } from "./decision-schema";
type Claims = ReturnType<typeof verifiedClaims>;
type Cases = ReturnType<typeof caseVotes>;

function hasMoreWeightedMajors(row: Decision["rows"][number], rival: Decision["rows"][number]) {
  return Object.entries(row.weightedMajorsByLanguage ?? {}).some(
    ([language, count]) => count > (rival.weightedMajorsByLanguage?.[language] ?? 0),
  );
}

export function decide(comparison: Comparison): Decision {
  const reads = acceptedReads(comparison);
  const cases = caseVotes(comparison, reads);
  const claims = verifiedClaims(comparison);
  const readers = readerRecords(comparison, reads);
  const rows = deliveryTable(comparison, cases, claims);
  const { choice } = assess(comparison, cases, claims, rows);

  const classified = rows.map((row) => {
    if (row.status === "disqualified" || choice.outcome === "insufficient evidence") {
      return row;
    }

    const rival = rows.find((other) => other.side !== row.side);

    if (!rival || rival.status === "disqualified") {
      return row;
    }

    const dominates =
      rival.wins >= row.wins &&
      rival.losses <= row.losses &&
      !hasMoreWeightedMajors(rival, row) &&
      row.costPer1000 !== null &&
      rival.costPer1000 !== null &&
      rival.costPer1000 <= row.costPer1000 &&
      row.p95 !== null &&
      rival.p95 !== null &&
      rival.p95 <= row.p95 &&
      rival.quality.every(
        (metric) =>
          metric.affected.length <=
          (row.quality.find(
            (candidate) =>
              candidate.language === metric.language &&
              candidate.criterion === metric.criterion &&
              candidate.check === metric.check,
          )?.affected.length ?? 0),
      ) &&
      (rival.wins > row.wins || rival.costPer1000 < row.costPer1000 || rival.p95 < row.p95);

    if (dominates) {
      return { ...row, status: "dominated" };
    }

    return {
      ...row,
      status: row.losses > 0 || hasMoreWeightedMajors(row, rival) ? "trade" : "eligible",
    };
  });

  return decisionSchema.parse({
    cases,
    preferences: readerPreferences({ manifest: comparison.manifest, reads }),
    readers,
    replay: comparison.replay,
    rows: classified,
    ...choice,
    reason: [choice.reason, ...runFailureReasons(comparison.manifest)].join(" "),
  });
}

function runFailureReasons({ runsCompared }: Comparison["manifest"]) {
  const bySide = Map.groupBy(
    runsCompared.flatMap((run) => run.failures),
    (failure) => failure.side,
  );

  return sides.flatMap((side) => {
    const counts = Map.groupBy(bySide.get(side) ?? [], (failure) => failure.reason);
    const reasons = [...counts].map(([reason, failures]) => `${failures.length} ${reason}`);
    return reasons.length > 0 ? [`The ${side} had run failures (${reasons.join(", ")}).`] : [];
  });
}

function assessComparison(comparison: Comparison) {
  const cases = caseVotes(comparison, acceptedReads(comparison));
  const claims = verifiedClaims(comparison);

  return assess(comparison, cases, claims, deliveryTable(comparison, cases, claims));
}

export function needsModelReads(comparison: Comparison) {
  return assessComparison(comparison).modelReads;
}

export function decisiveClaims(comparison: Comparison) {
  return assessComparison(comparison).decisive;
}

export function decisiveUnresolved(comparison: Comparison) {
  const cases = caseVotes(comparison, acceptedReads(comparison));

  const unresolved = cases.filter(
    (item) =>
      item.result === "unresolved" &&
      missingReaderFamilies(comparison.manifest, item.votes).length === 0,
  );

  if (unresolved.length === 0) {
    return [];
  }

  const claims = verifiedClaims(comparison);

  const outcome = assess(comparison, cases, claims, deliveryTable(comparison, cases, claims)).choice
    .outcome;

  const reserve = comparison.manifest.readers.find((reader) => reader.reserve);

  if (!reserve) {
    return [];
  }

  const possibilities = new Map(
    unresolved.map((item) => {
      const votes = Object.entries(item.votes)
        .filter(([family]) => family !== reserve.family)
        .map(([, vote]) => vote);

      const results = (["incumbent", "challenger", "tie"] as const)
        .map((vote) => settle([...votes, vote]))
        .filter((vote) => vote !== "unresolved");

      return [item.caseId, results] as const;
    }),
  );

  const matters = (["incumbent", "challenger"] as const).some((direction) => {
    const scenario = cases.map((item) => {
      const outcomes = possibilities.get(item.caseId);

      if (!outcomes?.length) {
        return item;
      }

      const best = outcomes.includes(direction)
        ? direction
        : (outcomes.find((vote) => vote === "tie") ?? outcomes[0]);

      return { ...item, result: best ?? item.result };
    });

    return (
      assess(comparison, scenario, claims, deliveryTable(comparison, scenario, claims)).choice
        .outcome !== outcome
    );
  });

  return matters
    ? [...possibilities].filter(([, values]) => values.length > 0).map(([id]) => id)
    : [];
}

type Choice = Pick<Decision, "outcome" | "reason" | "reasonCode">;
type TableRow = Decision["rows"][number];

export function uncheckedAnswerKeys({ manifest, checks }: Comparison) {
  if (!manifest.requiresAnswerKeyCheck) {
    return [];
  }

  return manifest.runsCompared.flatMap(({ caseId, run, ...slots }) =>
    sides
      .filter(
        (side) =>
          slots[side] &&
          !checks.some(
            (check) =>
              check.name === "answer keys" &&
              check.caseId === caseId &&
              check.run === run &&
              check.side === side &&
              (check.total > 0 || (check.total === 0 && check.passed === 0)),
          ),
      )
      .map((side) => ({ caseId, run, side })),
  );
}

function availableCaseResults(manifest: Comparison["manifest"], item: Cases[number]): Direction[] {
  if (item.result !== "unresolved") {
    return [item.result];
  }

  const missing = missingReaderFamilies(manifest, item.votes).length;
  const owner = item.owner && item.owner !== "split" ? [item.owner] : directions;

  if (missing === 0) {
    return owner;
  }

  return [...directions, "split" as const].flatMap((vote) => {
    const model = settle([
      ...Object.values(item.votes),
      ...Array.from({ length: missing }, () => vote),
    ]);

    return model === "unresolved" ? owner : [model];
  });
}

const directions: Direction[] = ["incumbent", "tie", "challenger"];

function preferenceBounds(manifest: Comparison["manifest"], cases: Cases) {
  const possibilities = cases.map((item) => availableCaseResults(manifest, item));

  return {
    best: possibilities.map((votes) => directions.findLast((vote) => votes.includes(vote))),
    worst: possibilities.map((votes) => directions.find((vote) => votes.includes(vote))),
  };
}

function assessReading({
  cases,
  decisive,
  manifest,
}: {
  cases: Cases;
  decisive?: Claims;
  manifest: Comparison["manifest"];
}) {
  const unresolved = cases.filter((item) => item.result === "unresolved");

  if (unresolved.some((item) => !canAdjudicate(manifest, item))) {
    return assessment(
      result("insufficient evidence", "Some unresolved cases are awaiting qualified model reads."),
      decisive,
      true,
    );
  }

  return assessment(
    {
      ...result("insufficient evidence", "Your blind read can settle the unresolved cases."),
      reasonCode: "owner_blind_read_required",
    },
    decisive,
    true,
  );
}

const hardChoice = result(
  "insufficient evidence",
  "A pending major claim could rule out a variant.",
);

function assess(comparison: Comparison, cases: Cases, claims: Claims, rows: Decision["rows"]) {
  const { manifest } = comparison;
  const [incumbent, challenger] = rows;
  const rules = manifest.priorities.comparison;

  if (!manifest.variants.incumbent || !incumbent || !challenger) {
    return assessment(result("insufficient evidence", "Single-output audit."), [], true);
  }

  const challengerFailed = challenger.status === "disqualified";

  if (incumbent.status === "disqualified" && challengerFailed) {
    return assessment(result("neither qualifies", "Both variants failed a hard requirement."));
  }

  const pending = claims.filter((claim) => claim.finding === "unsure");

  const hard = pending.filter(
    (claim) => rules?.criteria[claim.observation.criterion] === "disqualifies",
  );

  if (incumbent.missingMatches > 0 && missingMatchMatters({ challengerFailed, manifest })) {
    return assessment(
      result("insufficient evidence", "Some runs are missing a matched output."),
      hard,
    );
  }

  const unchecked = uncheckedAnswerKeys(comparison);

  if (challengerFailed) {
    const open = hardRequirementChoice(hard);

    return assessment(open ?? result("retain", "The challenger failed a hard requirement."), hard);
  }

  if (!rules || manifest.criteria.some((item) => !rules.criteria[item.id])) {
    return assessment(
      result("insufficient evidence", "Some criterion priorities are missing."),
      hard,
    );
  }

  return assessEligibleChallenger({
    cases,
    challenger,
    comparison,
    hard,
    incumbent,
    pending,
    rules,
    unchecked,
  });
}

function missingMatchMatters({
  challengerFailed,
  manifest,
}: {
  challengerFailed: boolean;
  manifest: Comparison["manifest"];
}) {
  const rules = manifest.priorities.comparison;

  return (
    !challengerFailed ||
    manifest.runsCompared.some((run) => !run.incumbent) ||
    Boolean(manifest.latencyBudget) ||
    manifest.criteria.some((criterion) => rules?.criteria[criterion.id] !== "counts")
  );
}

function assessEligibleChallenger({
  cases,
  challenger,
  comparison,
  hard,
  incumbent,
  pending,
  rules,
  unchecked,
}: {
  cases: Cases;
  challenger: TableRow;
  comparison: Comparison;
  hard: Claims;
  incumbent: TableRow;
  pending: Claims;
  rules: NonNullable<Comparison["manifest"]["priorities"]["comparison"]>;
  unchecked: ReturnType<typeof uncheckedAnswerKeys>;
}) {
  const { manifest } = comparison;
  const preferences = preferenceBounds(manifest, cases);

  const trade = tradeBounds({
    cases,
    challenger,
    comparison,
    incumbent,
    pending,
    rules,
    uncheckedKeys: unchecked,
  });

  const decideWithinBounds = (votes: typeof preferences.best, deficit: string | undefined) =>
    eligibleChoice({ challenger, deficit, incumbent, manifest, votes });

  const best = decideWithinBounds(preferences.best, trade.best);
  const worst = decideWithinBounds(preferences.worst, trade.worst);
  const open = hardRequirementChoice(hard);

  if (open) {
    return assessment(open, hard);
  }

  if (best.outcome === "switch" && unchecked.length > 0) {
    return assessment(result("insufficient evidence", "Some answer keys are unchecked."));
  }

  if (best.outcome !== worst.outcome) {
    return assessOpenTradeOrReads({
      best,
      cases,
      decideWithinBounds,
      manifest,
      preferences,
      trade,
    });
  }

  if (best.outcome === "switch") {
    return switchCoverage({ cases, manifest }) ?? assessment(best);
  }

  if (
    best.reason === preferenceReason &&
    (pending.length > 0 || cases.some((item) => item.result === "unresolved"))
  ) {
    return assessment(
      result(
        "retain",
        "More cases prefer the incumbent. The open cases and claims can’t change the decision.",
      ),
    );
  }

  const current = decideWithinBounds(
    cases.map((item) =>
      item.result === "unresolved" ? (item.legacyOwner ?? undefined) : item.result,
    ),
    trade.current,
  );

  return assessment(current.outcome === best.outcome ? current : best);
}

function assessment(choice: Choice, decisive: Claims = [], modelReads = false) {
  return { choice, decisive, modelReads };
}

function hardRequirementChoice(hard: Claims) {
  // One verifier can confirm a hard failure on both outputs, regardless of whom the reader named.
  return hard.length > 0 ? hardChoice : null;
}

function switchCoverage({ cases, manifest }: { cases: Cases; manifest: Comparison["manifest"] }) {
  if (cases.some((item) => missingReaderFamilies(manifest, item.votes).length > 0)) {
    return assessReading({ cases, manifest });
  }

  const unread = cases.filter((item) => needsBlindOwnerRead(manifest, item));

  if (unread.some((item) => item.adjudication)) {
    return assessment(
      result(
        "insufficient evidence",
        "Shared content needs a new comparison for cases ruled on before a blind read.",
      ),
    );
  }

  return unread.length > 0
    ? assessment(result("insufficient evidence", "Shared content awaits the owner’s blind read."))
    : null;
}

function assessOpenTradeOrReads({
  best,
  cases,
  decideWithinBounds,
  manifest,
  preferences,
  trade,
}: {
  best: Choice;
  cases: Cases;
  decideWithinBounds: (votes: (Direction | undefined)[], deficit: string | undefined) => Choice;
  manifest: Comparison["manifest"];
  preferences: ReturnType<typeof preferenceBounds>;
  trade: ReturnType<typeof tradeBounds>;
}) {
  const tradeMatters = decideWithinBounds(preferences.best, trade.worst).outcome !== best.outcome;
  const decisive = tradeMatters ? trade.decisive : [];

  if (decideWithinBounds(preferences.worst, trade.best).outcome !== best.outcome) {
    return assessReading({ cases, decisive, manifest });
  }

  return assessment(
    result(
      "insufficient evidence",
      trade.unchecked
        ? "Unfinished code checks could change the quality trade."
        : "Outstanding major claims could change the quality trade.",
    ),
    decisive,
  );
}

const preferenceReason = "More cases prefer the incumbent.";

function meetsWaitTrade({
  challenger,
  incumbent,
  manifest,
}: {
  challenger: TableRow;
  incumbent: TableRow;
  manifest: Comparison["manifest"];
}) {
  const target = manifest.priorities.comparison?.trade?.saveSeconds ?? null;
  const languages = Object.entries(incumbent.deliveryByLanguage);

  return (
    target !== null &&
    languages.length > 0 &&
    languages.every(([language, delivery]) => {
      const rival = challenger.deliveryByLanguage[language];
      return rival && meetsWaitSaving(delivery, rival, target);
    })
  );
}

function eligibleChoice({
  challenger,
  deficit,
  incumbent,
  manifest,
  votes,
}: {
  challenger: TableRow;
  deficit: string | undefined;
  incumbent: TableRow;
  manifest: Comparison["manifest"];
  votes: (Direction | undefined)[];
}): Choice {
  if (incumbent.status === "disqualified") {
    return result("switch", "Only the challenger qualifies.");
  }

  const { priorities } = manifest;
  const savings = (incumbent.costPer1000 ?? 0) - (challenger.costPer1000 ?? 0);
  const seconds = (incumbent.p95 ?? 0) - (challenger.p95 ?? 0);
  const faster = meetsWaitTrade({ challenger, incumbent, manifest });

  if (
    (priorities.comparison?.preference === "canBlock" || savings === 0) &&
    votes.filter((vote) => vote === "incumbent").length >
      votes.filter((vote) => vote === "challenger").length
  ) {
    return result("retain", preferenceReason);
  }

  if (deficit) {
    return result("retain", deficit);
  }

  if (savings < 0 && !faster) {
    return result("retain", "A pricier challenger needs owner judgment.");
  }

  if (priorities.first === "latency" && seconds < 0 && !faster) {
    return result("retain", "The challenger lengthens the wait.");
  }

  if (savings === 0 && !votes.includes("challenger") && seconds <= 0 && !faster) {
    return result("retain", "No demonstrated improvement.");
  }

  return result("switch", switchReason({ faster, manifest, savings }));
}

function switchReason({
  faster,
  manifest,
  savings,
}: {
  faster: boolean;
  manifest: Comparison["manifest"];
  savings: number;
}) {
  if (savings <= 0 && faster) {
    return "The challenger saves the required median wait and meets the weighted quality trade in every language.";
  }

  if (manifest.priorities.comparison?.trade) {
    return "The challenger meets the weighted quality trade in every language.";
  }

  const cost = savings > 0 ? " It costs less per successful delivery." : "";
  const unit = manifest.runs > 1 ? "runs" : "cases";

  return `The challenger has no more weighted major-affected ${unit} in any language.${cost}`;
}

function result(outcome: Decision["outcome"], reason: string): Choice {
  return { outcome, reason };
}
