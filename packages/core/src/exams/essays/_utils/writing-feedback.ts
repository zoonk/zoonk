import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type z } from "zod";
import { type WritingResult, type writtenItemSchema } from "../writing-contract";
import { getWritingDecimals, getWritingRowDecimals } from "./writing-decimals";
import { verifyWritingErrors } from "./writing-errors";
import { type RowMark, markWritingRows } from "./writing-marks";
import { selectNextStep, writingRuleNextStep } from "./writing-next-step";
import { createWritingQuoteLookup } from "./writing-quotes";
import { isComputableSheet, topAwardPoints } from "./writing-sheet";
import {
  criterionCeilings,
  roundWritingRange,
  scoreWritingSheet,
  verifiedLimits,
} from "./writing-sheet-score";
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

/**
 * How fully a criterion is met, after any verified limit on it: a criterion capped below its
 * maximum is never complete, so the next step can point at the points the cap took.
 */
function criterionLevel({
  grading,
  id,
  limits,
  marks,
}: {
  grading: Basis["grading"];
  id: string;
  limits: ReturnType<typeof verifiedLimits>;
  marks: readonly RowMark[];
}): Level {
  const own = marks.filter(({ row }) => row.criterionId === id);
  const scale = own.find(({ row }) => row.kind !== "aspect");

  const standing = scale
    ? { earned: scale.verified ?? scale.reported, max: scale.row.awards.length - 1 }
    : aspectStanding(own);

  const criterion = grading.criteria.find((rule) => rule.id === id);
  const max = criterion && (criterion.points ?? topAwardPoints(criterion.awards ?? []));

  if (!max) {
    return toLevel(standing);
  }

  const share = Math.min(...criterionCeilings({ id, limits, max })) / max;

  return toLevel({ earned: Math.min(standing.earned, standing.max * share), max: standing.max });
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
  const limits = verifiedLimits({ eligible, evidence, sheet: basis.grading });

  const passage = (quote: string | null) => {
    const span = lookup.locateUnique(quote);
    return span && eligible.slice(span.start, span.end);
  };

  const criteria = basis.criteria.map(({ id, name }): Feedback["criteria"][number] => {
    const assessed = byId.get(id);

    return {
      comment: assessed?.comment ?? "",
      id,
      level: criterionLevel({ grading: basis.grading, id, limits, marks }),
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

function getLanguagePenalty({
  basis,
  errorCount,
  estimatedLines,
}: {
  basis: Basis;
  errorCount: number;
  estimatedLines: number;
}) {
  const { language } = basis.grading;
  const applicableLines = Math.max(1, Math.min(estimatedLines, basis.lines ?? estimatedLines));
  const penalty = (language?.factor ?? 0) * errorCount;
  const perLine = language?.method === "errorsPerLine";

  return {
    high: penalty / (perLine ? Math.max(1, applicableLines - 1) : 1),
    low: penalty / (perLine ? applicableLines : 1),
  };
}

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
    decimals: getWritingRowDecimals({ earned: range.low, max, range }),
    earned: range.low,
    id,
    max,
    ...(range.low !== range.high && { range }),
  }));

  const { content } = score;

  const penalty = getLanguagePenalty({ basis, errorCount: feedback.errors.length, estimatedLines });

  const deduction = {
    high: Math.min(content.high, penalty.high),
    low: Math.min(content.low, penalty.low),
  };

  const total = roundWritingRange({
    range: zero
      ? { high: 0, low: 0 }
      : {
          high: Math.max(0, content.high - penalty.low),
          low: Math.max(0, content.low - penalty.high),
        },
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
