import { PlanAdaptationReason } from "@zoonk/db";
import { z } from "zod";

const planAdjustmentSchema = z
  .enum(["addTime", "narrowScope", "moveDate"])
  .meta({
    description:
      "What the learner can change when the plan doesn't fit: more daily time, less to study, or a later date (only for a goal with a date)",
    id: "PlanAdjustment",
  });

const fitCoverageSchema = z
  .object({
    coreFits: z
      .boolean()
      .describe("Every topic is in the plan by the deadline, at least its core lessons."),
    coveredShare: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .describe(
        "What the stored plan covers of the chosen requirement by the deadline, weighted by what each skill is worth; null when nothing is measured.",
      ),
    deadline: z.iso
      .date()
      .describe("The last day new lessons count by: an exam's final stretch start, else the date."),
    measure: z
      .enum(["exam", "goal"])
      .describe("exam: weighted by the exam's subjects; goal: by skill weight."),
  })
  .meta({ id: "PlanFitCoverage" });

/**
 * Whether the stored plan reaches the goal by its date (`fits`), with how much it covers. A plan
 * that may not reflect its inputs yet, or whose numbers are of another date, is `pending`, never
 * `fits`; one whose stored work doesn't fit stays `doesNotFit` whatever is pending.
 */
const planFitSchema = z
  .discriminatedUnion("verdict", [
    z.object({ coverage: fitCoverageSchema, verdict: z.literal("fits") }),
    z.object({
      coverage: fitCoverageSchema.nullable(),
      evidence: z
        .enum(["coverage", "workAfterDate"])
        .describe(
          "coverage: the stored plan covers less than the requirement by the deadline; workAfterDate: it has work to do after the goal's date.",
        ),
      options: z.array(planAdjustmentSchema),
      verdict: z.literal("doesNotFit"),
    }),
    z.object({
      coverage: fitCoverageSchema
        .nullable()
        .describe("The numbers as of `asOf`, or null without any that describe the plan."),
      verdict: z.literal("pending"),
    }),
    z.object({ verdict: z.literal("noDeadline") }),
  ])
  .meta({ id: "PlanFit" });

/** The learner's pace against the stored plan's dates; never whether it reaches the goal. */
const planPaceSchema = z
  .union([
    z.object({ days: z.int().positive(), kind: z.literal("ahead") }),
    z.object({ kind: z.literal("onPace") }),
    z.object({
      catchUp: z.null(),
      kind: z.literal("behind"),
      lessons: z
        .int()
        .positive()
        .describe("Lessons earlier days left, which a new day moves first."),
    }),
    z.object({
      catchUp: z
        .object({ days: z.int().positive(), extraMinutesPerDay: z.int().positive() })
        .nullable()
        .describe("The small fix that catches up by the dates; null when no small fix does."),
      kind: z.literal("behind"),
      lessons: z.null(),
    }),
  ])
  .meta({ id: "PlanPace" });

const planLifecycleSchema = z
  .discriminatedUnion("kind", [
    z.object({ challenges: z.int().positive(), kind: z.literal("challengesLeft") }),
    z.object({ kind: z.literal("finished") }),
    z.object({ kind: z.literal("pastDate"), lessons: z.int().positive() }),
  ])
  .meta({ id: "PlanLifecycle" });

const planPendingSchema = z
  .object({
    legacy: z
      .boolean()
      .describe("No stored numbers describe the plan yet: they come with its next layout."),
    reasons: z
      .array(z.enum(PlanAdaptationReason))
      .describe(
        "What changed that the stored plan doesn't reflect yet; opening the day adapts it.",
      ),
  })
  .meta({ id: "PlanPending" });

/**
 * Where a stored plan stands, read from it without planning anything: whether it reaches the goal
 * (`fit`), how the learner keeps it (`pace`), whether it ended or waits on challenges
 * (`lifecycle`), what it may not reflect yet (`pending`), and the layout its numbers are as of.
 * @public The API's plan routes serialize it.
 */
export const planAssessmentSchema = z
  .object({
    asOf: z
      .object({ layoutStudyDay: z.iso.date(), planVersion: z.int().positive() })
      .nullable()
      .describe("The layout the plan's numbers are as of; null without numbers that describe it."),
    fit: planFitSchema,
    lifecycle: planLifecycleSchema.nullable(),
    pace: planPaceSchema
      .nullable()
      .describe("Null while nothing is scheduled, or for a plan only Plus moves."),
    pending: planPendingSchema
      .nullable()
      .describe("Null when the plan reflects everything it's planned from."),
  })
  .meta({ id: "PlanAssessment" });

export type PlanAdjustment = z.infer<typeof planAdjustmentSchema>;
export type FitCoverage = z.infer<typeof fitCoverageSchema>;
export type PlanFit = z.infer<typeof planFitSchema>;
export type PlanLifecycle = z.infer<typeof planLifecycleSchema>;
export type PlanPace = z.infer<typeof planPaceSchema>;
export type PlanAssessment = z.infer<typeof planAssessmentSchema>;

/**
 * What a plan's screens say first about it (see `readPlanHeadline`).
 * @public The apps' plan screens read it.
 */
export type PlanHeadline =
  | { kind: "doesNotFit"; options: PlanAdjustment[] }
  | { kind: "lifecycle"; lifecycle: PlanLifecycle }
  | { kind: "pace"; pace: PlanPace }
  | { kind: "pending" };

/**
 * The one rule for what a plan's screens say first: how its life stands when it ended or waits on
 * challenges, else that it doesn't fit (with what the learner can change), else that it's being
 * updated while anything is pending, else the learner's pace. Null when there's no pace to tell.
 * @public The apps' plan screens read it.
 */
export function readPlanHeadline(assessment: PlanAssessment): PlanHeadline | null {
  const { fit, lifecycle, pace, pending } = assessment;

  if (lifecycle) {
    return { kind: "lifecycle", lifecycle };
  }

  if (fit.verdict === "doesNotFit") {
    return { kind: "doesNotFit", options: fit.options };
  }

  if (pending || fit.verdict === "pending") {
    return { kind: "pending" };
  }

  return pace ? { kind: "pace", pace } : null;
}
