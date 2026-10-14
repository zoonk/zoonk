import { z } from "zod";
import { planNumbersSchema } from "./numbers-contract";

const isoDateSchema = z.iso.date();

/**
 * The daily time a goal needs, as every screen that asks for a daily time recommends it: the
 * fewest minutes that study the whole goal in depth by its date, at the learner's study days. The
 * same number the plan shows once the learner chooses, since both read the plan the same way.
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
          "What the week asked about covers in depth by the goal's date at the daily time asked about (dailyMinutes, else the goal's own): a share of the exam's questions and points or of the goal's skills by weight (see measure). The time question's live estimate. Null without a date, or while not ready",
      }),
    maximum: z
      .object({ coveredShare: z.number().min(0).max(1), dailyMinutes: z.int() })
      .nullable()
      .meta({
        description:
          "When no daily time covers everything in depth: what the most time a day covers. Recommend that time, honestly, with the learner choosing where to focus",
      }),
    measure: z
      .enum(["exam", "goal"])
      .meta({
        description:
          "exam: a share of the exam's questions and points; goal: of the goal's skills by weight",
      }),
    numbers: planNumbersSchema
      .nullable()
      .describe(
        "The prospective actual schedule for the selected dailyMinutes and study week. Its coverage equals coveredShare; null while not ready.",
      ),
    readingNotice: z
      .boolean()
      .default(false)
      .meta({
        description:
          "True while the plan waits for the exam's official documents to be read, which can change the time it needs: ready stays false until the reading lands or the plan's wait for it ends",
      }),
    ready: z
      .boolean()
      .meta({
        description:
          "False while the plan is being built, or while it waits for placement or its exam's notice reading, which change what it needs: ask again in a few seconds",
      }),
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
    targetDateNamedMonth: z
      .boolean()
      .meta({
        description:
          "The date is the start of the month the learner named, standing for that month: say the month, not the day",
      }),
  })
  .meta({ id: "PlanTimeAdvice" });

export type PlanTimeAdvice = z.infer<typeof planTimeAdviceSchema>;

/**
 * The one daily time a plan recommends, everywhere it says one (the time step, the plan's reveal
 * and Plan, its editor, Today): the fewest minutes that study the whole goal in depth by its
 * date (`inDepth`), or, when no daily time does, the most time a day with the share it covers
 * (`more`). Null without a date. Pedro's time step said 1h 20min and his reveal 40 min, the time
 * that only brings every topic in: one number, one meaning.
 */
export function getRecommendedTime({
  maximum,
  recommendedMinutes,
}: Pick<PlanTimeAdvice, "maximum" | "recommendedMinutes">):
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
}: Pick<PlanTimeAdvice, "maximum" | "recommendedMinutes"> & { dailyMinutes: number }): ReturnType<
  typeof getRecommendedTime
> {
  const target = getRecommendedTime(advice);
  return target && target.dailyMinutes > dailyMinutes ? target : null;
}

/**
 * The week the learner would study: the weekdays, Sunday first (0; the plan's own days when
 * absent), the weekend's own time when it has one apart from the weekdays', and the weekdays' time
 * they're looking at (`dailyMinutes`, the goal's own when absent), which says what that time
 * covers (`coveredShare`) and never changes the time recommended.
 */
export type PlanTimeAdviceInput = {
  dailyMinutes?: number;
  studyDays?: readonly number[];
  weekendMinutes?: number;
};
