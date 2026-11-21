import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type z } from "zod";
import { type WritingResult, type writtenItemSchema } from "../writing-contract";
import { type WritingArithmetic } from "../writing-rubric-policy";
import { ENEM_WRITING_MAX, scoreEnemWriting } from "./enem-writing";
import { verifiedWritingZero } from "./writing-zero";

type Basis = z.infer<typeof writtenItemSchema>;
type Feedback = Omit<Extract<WritingResult, { kind: "levels" }>, "kind">;

const QUOTE_PUNCTUATION = new Map(
  ["'‘’‚‛", '"“”„‟', "-‐‑‒–—―﹘﹣－"].flatMap((group) =>
    Array.from(group, (part) => [part, group.slice(0, 1)] as const),
  ),
);

function comparableQuotePart(part: string): string {
  if (/^\p{White_Space}/u.test(part)) {
    return " ";
  }

  return QUOTE_PUNCTUATION.get(part) ?? part.toLowerCase();
}

function comparableQuote(text: string) {
  const offsets = [0];

  const value = Array.from(text.matchAll(/\p{White_Space}+|./gsu), ({ 0: part, index }) => {
    const comparable = comparableQuotePart(part);
    offsets[offsets.length + comparable.length - 1] = index + part.length;
    return comparable;
  }).join("");

  return { offsets, value };
}

/** Only unique matches are eligible, and their offsets refer to the original UTF-16 text. */
export function createWritingQuoteLookup(text: string) {
  const { offsets, value } = comparableQuote(text);

  return function findQuote(quote: string | null) {
    if (!quote || !/\P{White_Space}/u.test(quote.trim())) {
      return null;
    }

    const candidate = comparableQuote(quote).value;
    const matches: { end: number; start: number }[] = [];

    for (
      let index = value.indexOf(candidate);
      index !== -1;
      index = value.indexOf(candidate, index + 1)
    ) {
      const start = offsets[index];
      const end = offsets[index + candidate.length];

      if (start !== undefined && end !== undefined) {
        if (matches.length > 0) {
          return null;
        }

        matches.push({ end, start });
      }
    }

    return matches[0] ?? null;
  };
}

function exactStart(text: string, quote: string | null): number | null {
  if (!quote?.trim()) {
    return null;
  }

  const start = text.indexOf(quote);
  return start !== -1 && !text.includes(quote, start + 1) ? start : null;
}

function verifyErrors(eligible: string, errors: WritingEvidence["errors"]): Feedback["errors"] {
  const candidates = errors.flatMap((error) => {
    const start = exactStart(eligible, error.quote);

    return start !== null &&
      error.correction.trim() &&
      error.kind.trim() &&
      error.correction !== error.quote
      ? [{ ...error, start }]
      : [];
  });

  const unique = [...new Map(candidates.map((error) => [JSON.stringify(error), error])).values()];

  return unique
    .filter(
      (error) =>
        !unique.some(
          (other) =>
            other !== error &&
            other.start < error.start + error.quote.length &&
            error.start < other.start + other.quote.length,
        ),
    )
    .toSorted((first, second) => first.start - second.start);
}

export function buildWritingFeedback({
  basis,
  eligible,
  evidence,
  ignoredFrom,
  previousNextSteps,
}: {
  basis: Pick<Basis, "criteria">;
  eligible: string;
  evidence: WritingEvidence;
  ignoredFrom: number | null;
  previousNextSteps: readonly string[];
}): Feedback {
  const byId = new Map(evidence.criteria.map((criterion) => [criterion.id, criterion]));
  const findQuote = createWritingQuoteLookup(eligible);

  const passage = (quote: string | null) => {
    const span = findQuote(quote);
    return span && eligible.slice(span.start, span.end);
  };

  const criteria = basis.criteria.map(({ id, name }): Feedback["criteria"][number] => {
    const assessed = byId.get(id);

    return {
      comment: assessed?.comment ?? "",
      id,
      level: assessed?.level ?? "missing",
      name,
      quote: passage(assessed?.quote ?? null),
    };
  });

  const next = evidence.nextStep;
  const target = criteria.find((criterion) => criterion.id === next?.criterionId);

  const nextStep =
    next && target && target.level !== "complete" && next.text.trim()
      ? { ...next, quote: passage(next.quote) }
      : null;

  const prior = new Set(previousNextSteps);
  const addressed = criteria.filter(({ id }) => prior.has(id) && byId.has(id));

  const resolved = ({ level, quote }: Feedback["criteria"][number]) =>
    quote !== null && (level === "strong" || level === "complete");

  return {
    criteria,
    errors: verifyErrors(eligible, evidence.errors),
    ignoredFrom,
    nextStep,
    progress:
      addressed.length > 0
        ? {
            fixed: addressed.filter((criterion) => resolved(criterion)).map(({ id }) => id),
            persists: addressed.filter((criterion) => !resolved(criterion)).map(({ id }) => id),
          }
        : null,
  };
}

function round(value: number, rule: WritingArithmetic["rounding"]) {
  if (!rule) {
    return value;
  }

  const scale = 10 ** rule.places;
  const scaled = value * scale;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled));
  const snap = rule.mode === "down" ? Math.floor : Math.round;
  return snap(scaled + tolerance) / scale;
}

const SCORE_PRECISION = 15;

function addPoints(first: number, second: number): number {
  return Number((first + second).toPrecision(SCORE_PRECISION));
}

function scoreRows({
  basis,
  eligible,
  evidence,
}: {
  basis: Basis;
  eligible: string;
  evidence: WritingEvidence;
}) {
  const byAspect = Map.groupBy(evidence.aspects, ({ aspectIndex }) => aspectIndex);
  const byCriterion = Map.groupBy([...basis.aspects.entries()], ([, aspect]) => aspect.criterionId);
  const findQuote = createWritingQuoteLookup(eligible);

  return basis.grading.criteria.flatMap(({ id, points }) => {
    const aspects = byCriterion.get(id);

    if (
      points === null ||
      !aspects?.length ||
      aspects.some(([, aspect]) => aspect.points === null)
    ) {
      return [];
    }

    const total = aspects.reduce((sum, [, aspect]) => addPoints(sum, aspect.points ?? 0), 0);

    if (total !== points) {
      return [];
    }

    const earned = aspects.reduce((sum, [index, aspect]) => {
      const reports = byAspect.get(index);

      if (reports?.length !== 1) {
        return sum;
      }

      const [report] = reports;

      return report?.earned && report.criterionId === id && findQuote(report.quote)
        ? addPoints(sum, aspect.points ?? 0)
        : sum;
    }, 0);

    return [{ earned, id, max: points }];
  });
}

function getDeduction({
  basis,
  content,
  errorCount,
  estimatedLines,
}: {
  basis: Basis;
  content: number;
  errorCount: number;
  estimatedLines: number;
}) {
  const { language } = basis.grading;
  const applicableLines = Math.max(1, Math.min(estimatedLines, basis.lines ?? estimatedLines));
  const penalty = (language?.factor ?? 0) * errorCount;
  const perLine = language?.method === "errorsPerLine";

  return {
    high: Math.min(content, penalty / (perLine ? Math.max(1, applicableLines - 1) : 1)),
    low: Math.min(content, penalty / (perLine ? applicableLines : 1)),
  };
}

export function applyWritingArithmetic({
  arithmetic,
  basis,
  context,
  eligible,
  estimatedLines,
  evidence,
  feedback,
}: {
  arithmetic: WritingArithmetic | null;
  basis: Basis;
  context: string | null;
  eligible: string;
  estimatedLines: number;
  evidence: WritingEvidence;
  feedback: Feedback;
}): WritingResult {
  const levels = { ...feedback, kind: "levels" as const };
  const { grading, points } = basis;
  const { language, rounding } = grading;

  if (
    !arithmetic ||
    points === null ||
    grading.kind === "levels" ||
    Boolean(rounding) !== Boolean(arithmetic.rounding) ||
    (language && (language.method === "other" || language.factor === null || !language.formula))
  ) {
    return levels;
  }

  const zeroReason = verifiedWritingZero({
    basis,
    context,
    eligible,
    evidence,
    ruleIndexes: arithmetic.zeroRules,
  });

  if (grading.kind === "enem") {
    const score = points === ENEM_WRITING_MAX ? scoreEnemWriting(evidence, zeroReason) : null;

    return score
      ? {
          ...feedback,
          ...score,
          deduction: { high: 0, low: 0 },
          kind: "points",
          max: points,
          total: score.content,
          zeroReason,
        }
      : levels;
  }

  const rows = scoreRows({ basis, eligible, evidence });

  if (
    rows.length !== grading.criteria.length ||
    new Set(rows.map(({ id }) => id)).size !== rows.length ||
    rows.reduce((sum, row) => addPoints(sum, row.max), 0) !== points
  ) {
    return levels;
  }

  const content = rows.reduce((sum, row) => addPoints(sum, row.earned), 0);

  const deduction = getDeduction({
    basis,
    content,
    errorCount: feedback.errors.length,
    estimatedLines,
  });

  const total = (deducted: number) =>
    zeroReason ? 0 : Math.min(points, Math.max(0, round(content - deducted, arithmetic.rounding)));

  return {
    ...feedback,
    content: { high: content, low: content },
    deduction,
    kind: "points",
    max: points,
    rows,
    total: { high: total(deduction.low), low: total(deduction.high) },
    zeroReason,
  };
}
