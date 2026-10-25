import { z } from "zod";
import { planNumbersSchema } from "./numbers-contract";

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
 * study: the plan that time plans, as the plan shows it once they choose it, studying everything
 * when the learner asks about that for an exam (`fullCourse`), with the day it would end. Only
 * that time: the time that covers everything is asked for on its own (see `PlanTimeToCover`).
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
          "What the week asked about covers in depth by the goal's date at the daily time asked about (dailyMinutes, else the goal's own), studying everything when fullCourse is asked: a share of the exam's questions and points or of the goal's skills by weight (see measure). Null without a date, or while not ready",
      }),
    fullCourseEndDate: isoDateSchema
      .nullable()
      .default(null)
      .meta({
        description:
          "For an exam asked about with fullCourse: the day the plan studying everything ends at the time asked about, going on after the exam for what doesn't fit before it. Null when not asked, for other goals, while not ready, and when even that plan can't fit everything in the time it plans (a few minutes a day for a big exam)",
      }),
    measure: measureSchema,
    numbers: planNumbersSchema
      .nullable()
      .describe(
        "The prospective actual schedule for the selected dailyMinutes and study week, studying everything when fullCourse is asked. Its coverage equals coveredShare; null while not ready.",
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
 * that time covers everything. For a goal that isn't an exam, falling short in its own week, also
 * the earliest date its own time covers everything by.
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
          "For a goal that isn't an exam and doesn't cover everything by its date in its own week, or whose date passed (no studyDays or weekendMinutes asked about): the earliest date the learner's own time covers everything by, measured as the plan measures what it covers (once moved there, the plan says it covers everything), to send as it is with `setTargetDate`. Null otherwise, and when no date within a week of the plan's end without a date does",
      }),
    readingNotice: readingNoticeSchema,
    ready: readySchema,
    recommendedMinutes: z
      .int()
      .nullable()
      .meta({
        description:
          "Daily minutes that study the whole goal in depth by its date: the fewest up to 4 hours a day; above that, a time that does, which a weekly mock can make a little more than the fewest. Null without a date, while the plan is being built, or when not even a whole day does",
      }),
    targetDate: isoDateSchema
      .nullable()
      .meta({ description: "The goal's date, which the recommended time covers everything by" }),
    targetDateNamedMonth: targetDateNamedMonthSchema,
  })
  .meta({ id: "PlanTimeToCover" });

export type PlanTimeToCover = z.infer<typeof planTimeToCoverSchema>;

/**
 * The week the learner would study: the weekdays, Sunday first (0; the plan's own days when
 * absent), and the weekend's own time when it has one apart from the weekdays'.
 */
export type PlanTimeToCoverInput = { studyDays?: readonly number[]; weekendMinutes?: number };

/**
 * The week the learner would study (see `PlanTimeToCoverInput`), and the weekdays' time they're
 * looking at (`dailyMinutes`, the goal's own when absent), which says what that time covers
 * (`coveredShare`). For an exam, `fullCourse` plans that time studying everything, even after the
 * exam (see `PlanSettings.fullCourse`), and says when that ends (`fullCourseEndDate`); other goals
 * ignore it.
 */
export type PlanTimeAdviceInput = PlanTimeToCoverInput & {
  dailyMinutes?: number;
  fullCourse?: boolean;
};
