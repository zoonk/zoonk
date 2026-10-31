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

export const daySplitSchema = z
  .object({
    mine: z.int().meta({ description: "This goal's minutes of the day" }),
    others: z.int().meta({ description: "How many other goals share the day" }),
    rest: z.int().meta({ description: "The other goals' minutes of the day, together" }),
  })
  .nullable()
  .default(null)
  .meta({
    description:
      "How the day the goals typed together share splits among them, as saving the schedule splits it. Null for a goal typed alone",
  });

const suggestedTimeSchema = z
  .object({
    coveredShare: z
      .number()
      .min(0)
      .max(1)
      .meta({
        description:
          "What these minutes cover in depth by the date, measured as coveredShare is (see measure): 1 for everything",
      }),
    everyTopic: z
      .boolean()
      .meta({
        description:
          "These minutes bring every topic in, the ones asked most in more depth: false when the topics asked least wait. True for everything",
      }),
    kind: z
      .enum(["everything", "focus"])
      .meta({
        description:
          "everything: the minutes cover the whole goal in depth by its date (recommendedMinutes); focus: what's worth most first, never to be described as covering everything: 4 hours a day when covering everything takes more than most people keep up, or most's minutes when no time covers everything",
      }),
    minutes: z.int(),
    split: daySplitSchema.meta({
      description:
        "How these minutes split among the goals typed together, as saving the schedule splits them. Null for a goal typed alone, or when asked without studyDays",
    }),
  })
  .nullable()
  .default(null)
  .meta({
    description:
      "The daily time to recommend and start the learner on, never more than 4 hours a day: recommendedMinutes when it's at most that, else most's minutes when they are, else 4 hours. Show recommendedMinutes (or most) beside a focus time, so the learner sees what everything takes and can pick it. Null without a date, while not ready, and when the date has passed. With studyDays, like them, the day the goals typed together share",
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
    fittingDate: isoDateSchema
      .nullable()
      .meta({
        description:
          "For a goal that isn't an exam and doesn't cover everything by its date in its own week, or whose date passed (no studyDays or weekendMinutes asked about): the earliest date the learner's own time covers everything by, measured as the plan measures what it covers (once moved there, the plan says it covers everything), to send as it is with `setTargetDate`. Null otherwise, and when no date within a week of the plan's end without a date does",
      }),
    most: z
      .object({ coveredShare: z.number().min(0).max(1), minutes: z.int() })
      .nullable()
      .default(null)
      .meta({
        description:
          "When no daily time covers everything because part of it never fits, whatever the time (a whole day covers no more than half a day): the fewest daily minutes that cover as much as any time does, and that share. Say what those minutes cover rather than everything. Null when a time covers everything, when more time still helps (the date is too close), without a date and while not ready. With studyDays, the day the goals typed together share",
      }),
    pastDate: z
      .boolean()
      .default(false)
      .meta({
        description:
          "The goal's date has passed in the learner's time zone: no daily time covers it, so recommendedMinutes, most and suggested are null",
      }),
    readingNotice: readingNoticeSchema,
    ready: readySchema,
    recommendedMinutes: z
      .int()
      .nullable()
      .meta({
        description:
          "Daily minutes that study the whole goal in depth by its date: the fewest up to 4 hours a day; above that, a time that does, which a weekly mock can make a little more than the fewest. Null without a date, while the plan is being built, or when not even a whole day does. With studyDays, the least day the goals typed together share that gives this goal those minutes, at least 5 minutes for each goal. More than 4 hours a day is more than most people keep up: suggested is then the recommendation",
      }),
    suggested: suggestedTimeSchema,
    targetDate: isoDateSchema
      .nullable()
      .meta({ description: "The goal's date, which recommendedMinutes covers everything by" }),
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
