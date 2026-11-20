import { type Decision, decisionSchema } from "./decision-schema";
import { deliveryTable } from "./delivery-table";
import { acceptedReads, caseVotes, readerRecords, verifiedClaims } from "./evidence";
import { type Comparison } from "./schemas";

export { decisionSchema, type Decision } from "./decision-schema";
export { majorClaims } from "./evidence";
export function decide(comparison: Comparison): Decision {
  const { manifest } = comparison;
  const rules = manifest.priorities.comparison;
  const reads = acceptedReads(comparison);
  const cases = caseVotes(comparison, reads);
  const readers = readerRecords(comparison, reads);
  const claims = verifiedClaims(comparison);
  const rows = deliveryTable(comparison, cases, claims);
  const missing = rows.some((row) => row.missingMatches > 0);
  const languages = [...new Set(cases.map((item) => item.language))];

  const choice = choose({ cases, claims, languages, manifest, missing, rows, rules });

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
              candidate.language === metric.language && candidate.criterion === metric.criterion,
          )?.affected.length ?? 0),
      ) &&
      (rival.wins > row.wins || rival.costPer1000 < row.costPer1000 || rival.p95 < row.p95);

    if (dominates) {
      return { ...row, status: "dominated" };
    }

    return { ...row, status: row.losses > 0 ? "trade" : "eligible" };
  });

  return decisionSchema.parse({ cases, readers, rows: classified, ...choice });
}
type Facts = {
  manifest: Comparison["manifest"];
  rows: Decision["rows"];
  cases: Decision["cases"];
  claims: ReturnType<typeof verifiedClaims>;
  missing: boolean;
  languages: string[];
  rules: Comparison["manifest"]["priorities"]["comparison"];
};

function choose({ manifest, rows, cases, claims, missing, languages, rules }: Facts) {
  const incumbent = rows.find((record) => record.side === "incumbent");
  const challenger = rows.find((record) => record.side === "challenger");

  if (!incumbent || !challenger) {
    return result("insufficient evidence", "Single-output audit.");
  }

  if (challenger.status === "disqualified") {
    if (
      incumbent.status !== "disqualified" &&
      manifest.runsCompared.some((run) => !run.incumbent)
    ) {
      return result(
        "insufficient evidence",
        "The challenger failed, but the incumbent has missing outputs.",
      );
    }

    return incumbent.status === "disqualified"
      ? result("neither qualifies", "Both variants failed a hard requirement.")
      : result("retain", "The challenger failed a hard requirement.");
  }

  if (missing || !rules || manifest.criteria.some((item) => !rules.criteria[item.id])) {
    return result("insufficient evidence", "Missing matched runs or criterion priorities.");
  }

  if (
    cases.some(
      (item) =>
        item.result === "unresolved" &&
        (!item.owner || item.owner === "split" || Object.keys(item.votes).length < 2),
    )
  ) {
    return result("insufficient evidence", "Unresolved cases need an independent read.");
  }

  const pending = claims.filter(
    (mapping) => mapping.finding === "unsure" && mapping.side === "challenger",
  );

  if (pending.some((mapping) => rules.criteria[mapping.observation.criterion] === "disqualifies")) {
    return result("insufficient evidence", "A pending claim could disqualify the challenger.");
  }

  const savings = (incumbent.costPer1000 ?? 0) - (challenger.costPer1000 ?? 0);
  const seconds = (incumbent.p95 ?? 0) - (challenger.p95 ?? 0);

  if (incumbent.status === "disqualified") {
    return eligibleChoice({ cases, incumbent, priorities: manifest.priorities, savings, seconds });
  }

  const limits = evaluateTrades({ cases, challenger, incumbent, languages, pending, rules });

  if (limits) {
    return result(limits.outcome, limits.reason);
  }

  return eligibleChoice({ cases, incumbent, priorities: manifest.priorities, savings, seconds });
}

function eligibleChoice({
  cases,
  incumbent,
  savings,
  seconds,
  priorities,
}: {
  cases: Decision["cases"];
  incumbent: TableRow;
  savings: number;
  seconds: number;
  priorities: Comparison["manifest"]["priorities"];
}) {
  const votes = cases.map((item) => (item.result === "unresolved" ? item.owner : item.result));

  if (
    (priorities.comparison?.preference === "canBlock" || savings === 0) &&
    incumbent.status !== "disqualified" &&
    votes.filter((vote) => vote === "incumbent").length >
      votes.filter((vote) => vote === "challenger").length
  ) {
    return result("retain", "More cases prefer the incumbent.");
  }

  if (priorities.distribution === "shared" && cases.some((item) => !item.owner)) {
    return result("insufficient evidence", "Shared content awaits the owner’s blind read.");
  }

  if (incumbent.status === "disqualified") {
    return result("switch", "Only the challenger qualifies.");
  }

  if (savings < 0) {
    return result("retain", "A pricier challenger needs owner judgment.");
  }

  if (priorities.first === "latency" && seconds < 0) {
    return result("retain", "The challenger lengthens the wait.");
  }

  if (savings === 0 && !votes.includes("challenger") && seconds <= 0) {
    return result("retain", "No demonstrated improvement.");
  }

  return result("switch", "The challenger meets the accepted trade in every language.");
}

function result(outcome: Decision["outcome"], reason: string) {
  return { outcome, reason };
}

type TableRow = Decision["rows"][number];

function evaluateTrades({
  languages,
  cases,
  rules,
  pending,
  incumbent,
  challenger,
}: {
  languages: string[];
  cases: Decision["cases"];
  rules: NonNullable<Comparison["manifest"]["priorities"]["comparison"]>;
  pending: ReturnType<typeof verifiedClaims>;
  incumbent: TableRow;
  challenger: TableRow;
}) {
  const trade = rules.trade;

  for (const language of languages) {
    const before = incumbent.deliveryByLanguage[language];
    const after = challenger.deliveryByLanguage[language];

    const costShare =
      before?.costPer1000 && typeof after?.costPer1000 === "number"
        ? (before.costPer1000 - after.costPer1000) / before.costPer1000
        : null;

    const seconds =
      typeof before?.p95 === "number" && typeof after?.p95 === "number"
        ? before.p95 - after.p95
        : null;

    const ids = new Set(
      cases.filter((item) => item.language === language).map((item) => item.caseId),
    );

    const count = (row: typeof incumbent) =>
      new Set(
        row.quality
          .filter(
            (qualityRow) =>
              qualityRow.language === language && rules.criteria[qualityRow.criterion] === "counts",
          )
          .flatMap((qualityRow) => qualityRow.affected),
      );

    const known = count(challenger);

    const possible = new Set([
      ...known,
      ...pending.filter((mapping) => ids.has(mapping.caseId)).map((mapping) => mapping.caseId),
    ]);

    const allowed = (affectedCount: number) =>
      affectedCount <= count(incumbent).size ||
      Boolean(
        trade &&
        (affectedCount - count(incumbent).size) * 100 <= trade.majorIncreasePer100 * ids.size &&
        ((trade.saveCostShare !== null && costShare !== null && costShare >= trade.saveCostShare) ||
          (trade.saveSeconds !== null && seconds !== null && seconds >= trade.saveSeconds)),
      );

    if (!allowed(possible.size)) {
      return allowed(known.size)
        ? result(
            "insufficient evidence",
            "Outstanding major claims together could exceed the accepted trade.",
          )
        : result(
            "retain",
            `The verified quality deficit exceeds the accepted trade in ${language}.`,
          );
    }
  }

  return null;
}
