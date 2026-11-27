import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type z } from "zod";
import { type WritingResult, type writtenItemSchema } from "../writing-contract";
import { getWritingDecimals } from "./writing-decimals";
import { verifyWritingErrors } from "./writing-errors";
import { type RowMark, markWritingRows } from "./writing-marks";
import { selectNextStep, writingRuleNextStep } from "./writing-next-step";
import { createWritingQuoteLookup } from "./writing-quotes";
import { isComputableSheet, topAwardPoints } from "./writing-sheet";
import { roundWritingRange, scoreWritingSheet } from "./writing-sheet-score";
import { verifiedWritingZero } from "./writing-zero";

type Basis = z.infer<typeof writtenItemSchema>;
type Feedback = Omit<Extract<WritingResult, { kind: "levels" }>, "kind">;
type Level = Feedback["criteria"][number]["level"];

const POINTS_TOLERANCE = 1e-9;
const STRONG = { of: 3, parts: 2 } as const;
const PARTIAL = { of: 3, parts: 1 } as const;

function reaches(
  { earned, max }: { earned: number; max: number },
  share: typeof STRONG | typeof PARTIAL,
) {
  return earned * share.of >= max * share.parts - POINTS_TOLERANCE;
}

function toLevel(standing: { earned: number; max: number }): Level {
  if (standing.max <= 0 || standing.earned >= standing.max - POINTS_TOLERANCE) {
    return standing.max > 0 ? "complete" : "missing";
  }

  if (reaches(standing, STRONG)) {
    return "strong";
  }

  return reaches(standing, PARTIAL) ? "partial" : "missing";
}

function aspectStanding(marks: readonly RowMark[]) {
  const pointed = marks.every(({ row }) => topAwardPoints(row.awards) !== null);

  return marks.reduce(
    (sum, { row, verified }) => {
      const award = row.awards[verified ?? 0];
      const top = row.awards.length - 1;

      return pointed
        ? {
            earned: sum.earned + (award?.points ?? 0),
            max: sum.max + (topAwardPoints(row.awards) ?? 0),
          }
        : { earned: sum.earned + (verified ?? 0) / top, max: sum.max + 1 };
    },
    { earned: 0, max: 0 },
  );
}

/** A criterion's level is where its award sits on its scale, or the share of its aspects earned. */
function criterionLevel(id: string, marks: readonly RowMark[]): Level {
  const own = marks.filter(({ row }) => row.criterionId === id);
  const scale = own.find(({ row }) => row.kind !== "aspect");

  return toLevel(
    scale
      ? { earned: scale.verified ?? scale.reported, max: scale.row.awards.length - 1 }
      : aspectStanding(own),
  );
}

export function buildWritingFeedback({
  basis,
  eligible,
  evidence,
  ignoredFrom,
  previousNextSteps,
}: {
  basis: Pick<Basis, "aspects" | "criteria" | "grading">;
  eligible: string;
  evidence: WritingEvidence;
  ignoredFrom: number | null;
  previousNextSteps: readonly string[];
}): Feedback {
  const byId = new Map(evidence.criteria.map((criterion) => [criterion.id, criterion]));
  const lookup = createWritingQuoteLookup(eligible);
  const marks = markWritingRows({ basis, eligible, evidence });

  const passage = (quote: string | null) => {
    const span = lookup.locateUnique(quote);
    return span && eligible.slice(span.start, span.end);
  };

  const criteria = basis.criteria.map(({ id, name }): Feedback["criteria"][number] => {
    const assessed = byId.get(id);

    return {
      comment: assessed?.comment ?? "",
      id,
      level: criterionLevel(id, marks),
      name,
      quote: passage(assessed?.quote ?? null),
    };
  });

  const next = evidence.nextStep;

  const nextStep =
    next && next.text.trim()
      ? {
          ...next,
          kind: "criterion" as const,
          quote: passage(next.quote),
          title: next.title?.trim() || null,
        }
      : null;

  const prior = new Set(previousNextSteps);
  const addressed = criteria.filter(({ id }) => prior.has(id) && byId.has(id));

  const resolved = ({ level, quote }: Feedback["criteria"][number]) =>
    quote !== null && (level === "strong" || level === "complete");

  return {
    criteria,
    errors: verifyWritingErrors(eligible, evidence.errors),
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

/** `numeric` is false whenever points are off for this answer: the result then stays on levels. */
export function applyWritingArithmetic({
  basis,
  context,
  eligible,
  estimatedLines,
  evidence,
  feedback,
  numeric,
  belowWordFloor = false,
}: {
  basis: Basis;
  belowWordFloor?: boolean;
  context: string | null;
  eligible: string;
  estimatedLines: number;
  evidence: WritingEvidence;
  feedback: Feedback;
  numeric: boolean;
}): WritingResult {
  const levels = (): WritingResult => ({
    ...feedback,
    kind: "levels",
    nextStep:
      belowWordFloor && feedback.ignoredFrom === null
        ? writingRuleNextStep("short")
        : selectNextStep(feedback, evidence),
  });

  const { grading, points } = basis;

  if (!numeric || points === null || !isComputableSheet(basis)) {
    return levels();
  }

  const zero = verifiedWritingZero({ basis, context, eligible, evidence });

  if (belowWordFloor && !zero) {
    return levels();
  }

  const score = scoreWritingSheet({
    basis,
    eligible,
    evidence,
    marks: markWritingRows({ basis, eligible, evidence }),
    zero: zero !== null,
  });

  if (!score) {
    return levels();
  }

  const rows = score.scores.map(({ id, max, range }) => ({
    decimals: getWritingDecimals(max),
    earned: range.low,
    id,
    max,
    ...(range.low !== range.high && { range }),
  }));

  const { content } = score;

  const deduction = getDeduction({
    basis,
    content: content.low,
    errorCount: feedback.errors.length,
    estimatedLines,
  });

  const total = roundWritingRange({
    range: zero
      ? { high: 0, low: 0 }
      : { high: content.high - deduction.low, low: content.low - deduction.high },
    rounding: grading.rounding,
    stage: "total",
  });

  const within = (value: number) => Math.min(points, Math.max(0, value));

  return {
    ...feedback,
    ...(zero && { zeroKind: zero.kind }),
    content,
    decimals: getWritingDecimals(points, [grading]),
    deduction,
    kind: "points",
    max: points,
    nextStep: zero ? writingRuleNextStep("zero") : selectNextStep(feedback, evidence, rows),
    rows,
    total: { high: within(total.high), low: within(total.low) },
    zeroReason: zero?.reason ?? null,
  };
}
