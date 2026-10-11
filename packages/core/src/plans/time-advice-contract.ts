import { z } from "zod";

const isoDateSchema = z.iso.date();

/**
 * The daily time a goal needs, as every screen that asks for a daily time recommends it: the
 * fewest minutes that study the whole goal in depth by its date, at the learner's study days. The
 * same number the plan shows once the learner chooses, since both read the plan the same way.
 */
export const planTimeAdviceSchema = z
  .object({
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
 * and Journey, its editor, Today): the fewest minutes that study the whole goal in depth by its
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
 * The week the learner would study: the weekdays, Sunday first (0; the plan's own days when
 * absent), and the weekend's own time when it has one apart from the weekdays'.
 */
export type PlanTimeAdviceInput = { studyDays?: readonly number[]; weekendMinutes?: number };
