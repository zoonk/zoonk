import { z } from "zod";
import { planNumbersSchema } from "./numbers-contract";

/** The most time a day a plan studies: a learner who gives it can't be offered more. */
export { MAX_DAILY_MINUTES } from "./planner/plan-state";

const isoDateSchema = z.iso.date();

const measureSchema = z
  .enum(["exam", "goal"])
  .meta({
    description:
      "exam: a share of the exam's questions and points; goal: of the goal's skills by weight",
  });

const readingNoticeSchema = z
  .boolean()
  .default(false)
  .meta({
    description:
      "True while the plan waits for the exam's official documents to be read, which can change the time it needs: ready stays false until the reading lands or the plan's wait for it ends",
  });

const readySchema = z
  .boolean()
  .meta({
    description:
      "False while the plan is being built, or while it waits for placement or its exam's notice reading, which change what it needs: ask again in a few seconds",
  });

const targetDateNamedMonthSchema = z
  .boolean()
  .meta({
    description:
      "The date is the start of the month the learner named, standing for that month: say the month, not the day",
  });

/**
 * What the daily time the learner is looking at covers by the goal's date, in the week they'd
 * study: the plan that time plans, as the plan shows it once they choose it. Only that time: the
 * time that covers everything is asked for on its own (see `PlanTimeToCover`).
 */
export const planTimeAdviceSchema = z
  .object({
    coveredShare: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .meta({
        description:
          "What the week asked about covers in depth by the goal's date at the daily time asked about (dailyMinutes, else the goal's own): a share of the exam's questions and points or of the goal's skills by weight (see measure). Null without a date, or while not ready",
      }),
    measure: measureSchema,
    numbers: planNumbersSchema
      .nullable()
      .describe(
        "The prospective actual schedule for the selected dailyMinutes and study week. Its coverage equals coveredShare; null while not ready.",
      ),
    readingNotice: readingNoticeSchema,
    ready: readySchema,
    targetDate: isoDateSchema.nullable().meta({ description: "The goal's date" }),
    targetDateNamedMonth: targetDateNamedMonthSchema,
  })
  .meta({ id: "PlanTimeAdvice" });

export type PlanTimeAdvice = z.infer<typeof planTimeAdviceSchema>;

/**
 * The daily time a goal needs, found when the learner asks for it ("Find the time that covers
 * everything"): the fewest minutes that study the whole goal in depth by its date, at the
 * learner's study days, planning the goal at each daily time from the least. Exact: the plan at
 * that time covers everything. When no daily time does, what the most time a day covers, and for
 * a goal that isn't an exam, falling short in its own week, the earliest date its own time covers
 * everything by.
 */
export const planTimeToCoverSchema = z
  .object({
    coreMinutes: z
      .int()
      .nullable()
      .meta({
        description:
          "When even every topic's core lessons don't fit by the date: the fewest daily minutes that bring every topic in. Null when they all fit",
      }),
    fittingDate: isoDateSchema
      .nullable()
      .meta({
        description:
          "For a goal that isn't an exam and doesn't cover everything by its date in its own week (no studyDays or weekendMinutes asked about): the earliest date the learner's own time covers everything by, planned as the change that moves it, to send as it is with `setTargetDate`. Null otherwise, and when no date within a week of the plan's end without a date does",
      }),
    maximum: z
      .object({ coveredShare: z.number().min(0).max(1), dailyMinutes: z.int() })
      .nullable()
      .meta({
        description:
          "When no daily time covers everything in depth: what the most time a day covers by the date, when it's more than the learner's time does. Recommend that time, honestly, with the learner choosing where to focus",
      }),
    measure: measureSchema,
    readingNotice: readingNoticeSchema,
    ready: readySchema,
    recommendedMinutes: z
      .int()
      .nullable()
      .meta({
        description:
          "The fewest daily minutes that study the whole goal in depth by its date. Null without a date, while the plan is being built, or when no daily time does (see maximum)",
      }),
    targetDate: isoDateSchema
      .nullable()
      .meta({ description: "The goal's date, which the recommended time covers everything by" }),
    targetDateNamedMonth: targetDateNamedMonthSchema,
  })
  .meta({ id: "PlanTimeToCover" });

export type PlanTimeToCover = z.infer<typeof planTimeToCoverSchema>;

/**
 * The one daily time a plan recommends, wherever the learner asked for it (the time step, the
 * Plan's coverage card, its editor): the fewest minutes that study the whole goal in depth by its
 * date (`inDepth`), or, when no daily time does, the most time a day with the share it covers
 * (`more`). Null without a date. Pedro's time step said 1h 20min and his reveal 40 min, the time
 * that only brings every topic in: one number, one meaning.
 */
export function getRecommendedTime({
  maximum,
  recommendedMinutes,
}: Pick<PlanTimeToCover, "maximum" | "recommendedMinutes">):
  | { dailyMinutes: number; kind: "inDepth" }
  | { coveredShare: number; dailyMinutes: number; kind: "more" }
  | null {
  if (recommendedMinutes !== null) {
    return { dailyMinutes: recommendedMinutes, kind: "inDepth" };
  }

  return maximum && { ...maximum, kind: "more" };
}

/**
 * The daily time worth offering a learner whose plan doesn't cover their goal: the one plans
 * recommend (see `getRecommendedTime`), only when it's more than they give. Pedro's Plan offered
 * "10 min a day covers everything" beside his 15: less time, framed as covering more. Null when
 * no time is worth more; whether their own time covers everything is the plan's `timeCovers`.
 */
export function getMoreTime({
  dailyMinutes,
  ...advice
}: Pick<PlanTimeToCover, "maximum" | "recommendedMinutes"> & { dailyMinutes: number }): ReturnType<
  typeof getRecommendedTime
> {
  const target = getRecommendedTime(advice);
  return target && target.dailyMinutes > dailyMinutes ? target : null;
}

/**
 * The week the learner would study: the weekdays, Sunday first (0; the plan's own days when
 * absent), and the weekend's own time when it has one apart from the weekdays'.
 */
export type PlanTimeToCoverInput = {
  studyDays?: readonly number[];
  weekendMinutes?: number;
};

/**
 * The week the learner would study (see `PlanTimeToCoverInput`), and the weekdays' time they're
 * looking at (`dailyMinutes`, the goal's own when absent), which says what that time covers
 * (`coveredShare`).
 */
export type PlanTimeAdviceInput = PlanTimeToCoverInput & { dailyMinutes?: number };
