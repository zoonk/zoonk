import { z } from "zod";
import { EXAM_SCALES, isExamScale, isOnExamScale } from "../scoring/exam-scales";

/** A score beyond this is a typo on any exam scale the app knows. */
const MAX_SCORE = 10_000;

export const examResultScaleSchema = z
  .enum(["irt", "percent", "points", ...EXAM_SCALES])
  .meta({
    description:
      "irt for item response theory scales like ENEM's; ap, sat and toefl for those exams' own scales (1 to 5, 400 to 1600, bands 1 to 6)",
  });

/**
 * "How did it go?": the official result after the exam, in the exam's own terms. A learner may
 * only know whether they passed, or only their score; either is enough.
 */
export const examResultInputSchema = z
  .object({
    maxScore: z
      .number()
      .positive()
      .max(MAX_SCORE)
      .nullable()
      .meta({ description: "The most points possible, for a score in points" }),
    passed: z.boolean().nullable().meta({ description: "Null when the learner doesn't know yet" }),
    scale: examResultScaleSchema.nullable(),
    score: z.number().min(0).max(MAX_SCORE).nullable(),
  })
  .strict()
  .refine((input) => input.score !== null || input.passed !== null, {
    message: "Give a score, whether you passed, or both",
  })
  .refine((input) => input.score === null || input.scale !== null, {
    message: "A score needs its scale",
    path: ["scale"],
  })
  .refine(
    ({ scale, score }) => score === null || !isExamScale(scale) || isOnExamScale({ scale, score }),
    { message: "That score isn't on the exam's scale", path: ["score"] },
  )
  .meta({ id: "ExamResultInput" });

export type ExamResultInput = z.infer<typeof examResultInputSchema>;

/** The official result as the learner reported it. */
export type ExamResultView = {
  maxScore: number | null;
  passed: boolean | null;
  reportedAt: string;
  scale: ExamResultInput["scale"];
  score: number | null;
};

/** A stored report as the apps show it; an unknown stored scale reads as none. */
export function toExamResultView(row: {
  maxScore: number | null;
  passed: boolean | null;
  reportedAt: Date;
  scale: string | null;
  score: number | null;
}): ExamResultView {
  return {
    maxScore: row.maxScore,
    passed: row.passed,
    reportedAt: row.reportedAt.toISOString(),
    scale: examResultScaleSchema.safeParse(row.scale).data ?? null,
    score: row.score,
  };
}

const PERCENT = 100;

/**
 * Estimates without item response theory are percent correct, while learners report points out
 * of the exam's maximum; these convert between the two so a report and its estimate compare.
 */
export function percentToPoints({ maxScore, percent }: { maxScore: number; percent: number }) {
  return (percent / PERCENT) * maxScore;
}

export function pointsToPercent({ maxScore, points }: { maxScore: number; points: number }) {
  return (points / maxScore) * PERCENT;
}
