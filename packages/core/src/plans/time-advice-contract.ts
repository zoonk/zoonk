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

const suggestedTimeSchema = z
  .object({
    kind: z
      .enum(["everything", "everyTopic"])
      .meta({
        description:
          "everything: the time covers the whole goal in depth by its date (recommendedMinutes); everyTopic: it brings every topic in, some in less depth (coreMinutes)",
      }),
    minutes: z.int(),
  })
  .nullable()
  .default(null)
  .meta({
    description:
      "The daily time to start the learner on: recommendedMinutes when it's at most 4 hours a day, else coreMinutes when that is. Null when neither is, without a date, while not ready, and when the date has passed. With studyDays, like them, the day the goals typed together share",
  });

const targetDateNamedMonthSchema = z
  .boolean()
  .meta({
    description:
      "The date is the start of the month the learner named, standing for that month: say the month, not the day",
  });

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
    endDate: isoDateSchema
      .nullable()
      .default(null)
      .describe(
        "Estimated finish date for an undated goal at the requested daily time and study week, including practice and milestones. Null for dated goals, while not ready, or when the schedule cannot hold the whole selected curriculum. This estimate does not set a deadline.",
      ),
    fullCourseEndDate: isoDateSchema
      .nullable()
      .default(null)
      .meta({
        description:
          "For an exam asked about with fullCourse: the day the plan studying everything ends at the time asked about, going on after the exam for what doesn't fit before it. Null when not asked, for other goals, while not ready, when the time fits everything before the exam (nothing goes on after it), and when even that plan can't fit everything in the time it plans (a few minutes a day for a big exam)",
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

export const planTimeToCoverSchema = z
  .object({
    coreMinutes: z
      .int()
      .nullable()
      .meta({
        description:
          "When even every topic's core lessons don't fit by the date: the fewest daily minutes that bring every topic in. Null when they all fit. With studyDays, the least day the goals typed together share that gives this goal those minutes, at least 5 minutes for each goal",
      }),
    fittingDate: isoDateSchema
      .nullable()
      .meta({
        description:
          "For a goal that isn't an exam and doesn't cover everything by its date in its own week, or whose date passed (no studyDays or weekendMinutes asked about): the earliest date the learner's own time covers everything by, measured as the plan measures what it covers (once moved there, the plan says it covers everything), to send as it is with `setTargetDate`. Null otherwise, and when no date within a week of the plan's end without a date does",
      }),
    pastDate: z
      .boolean()
      .default(false)
      .meta({
        description:
          "The goal's date has passed in the learner's time zone: no daily time covers it, so recommendedMinutes, coreMinutes and suggested are null",
      }),
    readingNotice: readingNoticeSchema,
    ready: readySchema,
    recommendedMinutes: z
      .int()
      .nullable()
      .meta({
        description:
          "Daily minutes that study the whole goal in depth by its date: the fewest up to 4 hours a day; above that, a time that does, which a weekly mock can make a little more than the fewest. Null without a date, while the plan is being built, or when not even a whole day does. With studyDays, the least day the goals typed together share that gives this goal those minutes, at least 5 minutes for each goal: the time to save as the schedule answer",
      }),
    suggested: suggestedTimeSchema,
    targetDate: isoDateSchema
      .nullable()
      .meta({ description: "The goal's date, which the recommended time covers everything by" }),
    targetDateNamedMonth: targetDateNamedMonthSchema,
  })
  .meta({ id: "PlanTimeToCover" });

export type PlanTimeToCover = z.infer<typeof planTimeToCoverSchema>;

export type PlanSuggestedTime = NonNullable<PlanTimeToCover["suggested"]>;

/** `studyDays` are weekdays from Sunday (0); absent, the plan's own. */
export type PlanTimeToCoverInput = { studyDays?: readonly number[]; weekendMinutes?: number };

export type PlanTimeAdviceInput = PlanTimeToCoverInput & {
  dailyMinutes?: number;
  fullCourse?: boolean;
};
