import { type Decision, decisionSchema } from "./decision-schema";
import { deliveryTable } from "./delivery-table";
import { acceptedReads, caseVotes, readerRecords, settle, sides, verifiedClaims } from "./evidence";
import { type Comparison } from "./schemas";

export { decisionSchema, type Decision } from "./decision-schema";
export function decide(comparison: Comparison): Decision {
  return decisionWith(
    comparison,
    caseVotes(comparison, acceptedReads(comparison)),
    verifiedClaims(comparison),
  );
}

type Claims = ReturnType<typeof verifiedClaims>;
type Cases = ReturnType<typeof caseVotes>;

function decisionWith(comparison: Comparison, cases: Cases, claims: Claims): Decision {
  const { manifest } = comparison;
  const rules = manifest.priorities.comparison;
  const readers = readerRecords(comparison, acceptedReads(comparison));
  const rows = deliveryTable(comparison, cases, claims);
  const missing = rows.some((row) => row.missingMatches > 0);
  const languages = [...new Set(cases.map((item) => item.language))];

  const choice = choose({
    cases,
    claims,
    languages,
    manifest,
    missing,
    rows,
    rules,
    uncheckedKeys: uncheckedAnswerKeys(comparison).length > 0,
  });

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
export function decisiveClaims(comparison: Comparison) {
  const cases = caseVotes(comparison, acceptedReads(comparison));
  const claims = verifiedClaims(comparison);
  const rules = comparison.manifest.priorities.comparison;

  const pending = claims.filter(
    (claim) => claim.finding === "unsure" && rules?.criteria[claim.observation.criterion],
  );

  if (!comparison.manifest.variants.incumbent || !rules || pending.length === 0) {
    return [];
  }

  const table = deliveryTable(comparison, cases, claims);

  const hard = pending.filter(
    (claim) =>
      rules.criteria[claim.observation.criterion] === "disqualifies" &&
      table.some((row) => row.status !== "disqualified"),
  );

  if (hard.length > 0) {
    return hard;
  }

  const affected = (subject: "incumbent" | "challenger", caseId: string) =>
    table
      .find((row) => row.side === subject)
      ?.quality.some(
        (metric) =>
          rules.criteria[metric.criterion] === "counts" && metric.affected.includes(caseId),
      );

  const potential = (favored: "incumbent" | "challenger") =>
    claims.map((claim) => {
      if (claim.finding !== "unsure") {
        return claim;
      }

      if (claim.side !== favored) {
        return { ...claim, finding: "holds" as const };
      }

      return {
        ...claim,
        finding: affected(favored, claim.caseId)
          ? ("holds for both" as const)
          : ("doesn't hold" as const),
      };
    });

  const best = potential("challenger");
  const worst = potential("incumbent");

  const outcomes = [best, worst, claims].map(
    (scenario) => decisionWith(comparison, cases, scenario).outcome,
  );

  if (new Set(outcomes).size === 1) {
    return [];
  }

  const scenarios = [best, worst].map((scenario) => deliveryTable(comparison, cases, scenario));
  const languages = new Set(cases.map((item) => item.language));

  const decisive = new Set(
    [...languages].filter((language) => {
      const bounds = scenarios.map(
        ([incumbent, challenger]) =>
          incumbent &&
          challenger &&
          evaluateTrades({
            cases,
            challenger,
            incumbent,
            languages: [language],
            pending: [],
            rules,
          })?.outcome,
      );

      return bounds[0] !== bounds[1];
    }),
  );

  return pending.filter(
    (claim) =>
      cases.some((item) => item.caseId === claim.caseId && decisive.has(item.language)) &&
      !(affected("incumbent", claim.caseId) && affected("challenger", claim.caseId)),
  );
}

export function decisiveUnresolved(comparison: Comparison) {
  const cases = caseVotes(comparison, acceptedReads(comparison));
  const unresolved = cases.filter((item) => item.result === "unresolved");

  if (unresolved.length === 0) {
    return [];
  }

  const claims = verifiedClaims(comparison);
  const current = decisionWith(comparison, cases, claims);

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

    return decisionWith(comparison, scenario, claims).outcome !== current.outcome;
  });

  return matters
    ? [...possibilities].filter(([, values]) => values.length > 0).map(([id]) => id)
    : [];
}

type Facts = {
  manifest: Comparison["manifest"];
  rows: Decision["rows"];
  cases: ReturnType<typeof caseVotes>;
  claims: ReturnType<typeof verifiedClaims>;
  missing: boolean;
  languages: string[];
  rules: Comparison["manifest"]["priorities"]["comparison"];
  uncheckedKeys: boolean;
};

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
              check.total > 0,
          ),
      )
      .map((side) => ({ caseId, run, side })),
  );
}

function preferenceSettlesOpenEvidence({
  challenger,
  claims,
  incumbent,
  rules,
  savings,
}: {
  challenger: TableRow;
  claims: Claims;
  incumbent: TableRow;
  rules: NonNullable<Facts["rules"]>;
  savings: number;
}) {
  const pending = claims.filter((claim) => claim.finding === "unsure");

  return (
    (incumbent.unresolved > 0 || pending.length > 0) &&
    (rules.preference === "canBlock" || savings === 0) &&
    incumbent.status !== "disqualified" &&
    incumbent.wins > challenger.wins + incumbent.unresolved &&
    !pending.some((claim) => rules.criteria[claim.observation.criterion] === "disqualifies")
  );
}

function choose({
  manifest,
  rows,
  cases,
  claims,
  missing,
  languages,
  rules,
  uncheckedKeys,
}: Facts) {
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

  if (uncheckedKeys) {
    return result("insufficient evidence", "Some answer keys are unchecked.");
  }

  if (missing || !rules || manifest.criteria.some((item) => !rules.criteria[item.id])) {
    return result("insufficient evidence", "Missing matched runs or criterion priorities.");
  }

  const savings = (incumbent.costPer1000 ?? 0) - (challenger.costPer1000 ?? 0);

  if (preferenceSettlesOpenEvidence({ challenger, claims, incumbent, rules, savings })) {
    return result(
      "retain",
      "More cases prefer the incumbent. The open cases and claims can’t change the decision.",
    );
  }

  if (
    cases.some(
      (item) =>
        item.result === "unresolved" &&
        (!item.legacyOwner || item.legacyOwner === "split" || Object.keys(item.votes).length < 2),
    )
  ) {
    return {
      ...result("insufficient evidence", "Your blind read can settle the unresolved cases."),
      reasonCode: "owner_blind_read_required" as const,
    };
  }

  const pending = claims.filter(
    (mapping) => mapping.finding === "unsure" && mapping.side === "challenger",
  );

  if (pending.some((mapping) => rules.criteria[mapping.observation.criterion] === "disqualifies")) {
    return result("insufficient evidence", "A pending claim could disqualify the challenger.");
  }

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
  cases: ReturnType<typeof caseVotes>;
  incumbent: TableRow;
  savings: number;
  seconds: number;
  priorities: Comparison["manifest"]["priorities"];
}) {
  const votes = cases.map((item) =>
    item.result === "unresolved" ? item.legacyOwner : item.result,
  );

  if (
    (priorities.comparison?.preference === "canBlock" || savings === 0) &&
    incumbent.status !== "disqualified" &&
    votes.filter((vote) => vote === "incumbent").length >
      votes.filter((vote) => vote === "challenger").length
  ) {
    return result("retain", "More cases prefer the incumbent.");
  }

  if (
    priorities.distribution === "shared" &&
    cases.some((item) => !item.owner && !item.adjudication)
  ) {
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

  if (priorities.comparison?.trade) {
    return result("switch", "The challenger meets the accepted trade in every language.");
  }

  const cost = savings > 0 ? " It costs less per successful delivery." : "";

  return result(
    "switch",
    `The challenger has no more cases with a confirmed major problem in any language.${cost}`,
  );
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
            trade
              ? "Outstanding major claims together could exceed the accepted trade."
              : `Outstanding major claims could give the challenger more affected cases in ${language}.`,
          )
        : result(
            "retain",
            trade
              ? `The confirmed quality deficit exceeds the accepted trade in ${language}.`
              : `The challenger has more cases with a confirmed major problem in ${language}.`,
          );
    }
  }

  return null;
}
