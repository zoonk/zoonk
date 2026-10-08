import { z } from "zod";
import { anyPlanOperationSchema } from "./plan-contract";
import { type PlanChangeView } from "./plan-view-contract";
import { DAYS_PER_WEEK } from "./planner/plan-state";

const isoDateSchema = z.iso.date();

const weekdaySchema = z
  .int()
  .min(0)
  .max(DAYS_PER_WEEK - 1);

/**
 * The source of a change the exam's notice brings: research read the notice after the learner saw
 * their plan, or a check found a new or corrected notice. Clients answer it with Apply or "Keep
 * mine".
 */
export const NOTICE_SOURCE = "notice";

/**
 * The same statuses as the database's, listed here so clients can parse a change. `replaced`: a
 * proposal a newer change about the same thing replaced before the learner answered it.
 */
const PLAN_CHANGE_STATUSES = ["proposed", "applied", "declined", "undone", "replaced"] as const;

const areaTopicsSchema = z
  .object({
    area: z.string().meta({ description: "The plan's area, as plan changes name it" }),
    topics: z.array(z.string()).meta({ description: "In the notice's own words" }),
  })
  .meta({ id: "PlanEffectTopics" });

export const planEffectSchema = z
  .object({
    areaStarts: z
      .array(
        z.object({
          after: isoDateSchema.nullable(),
          area: z.string(),
          before: isoDateSchema.nullable(),
        }),
      )
      .optional()
      .meta({
        description:
          "For a focus: when each focused area's first lesson is due after the change and before it. It may stay after what the area builds on",
      }),
    endDateAfter: isoDateSchema
      .nullable()
      .meta({ description: "When the plan ends after the change" }),
    endDateBefore: isoDateSchema.nullable().meta({ description: "When it ended before" }),
    lessonsAdded: z.int().min(0),
    lessonsRemoved: z.int().min(0),
    reviewFirst: z
      .object({
        areas: z
          .array(z.string())
          .meta({ description: "The focused areas, or the parts of them the focus names" }),
        date: isoDateSchema.meta({ description: "The review day the focused topics open" }),
      })
      .optional()
      .meta({
        description:
          "For a focus: the next review day ahead (a class test's day before, a free plan's full review) asks the focused topics first",
      }),
    topicsAdded: z
      .array(areaTopicsSchema)
      .optional()
      .meta({ description: "The exam's notice topics the change brings into the plan, by area" }),
    topicsLeftOut: z
      .array(areaTopicsSchema)
      .optional()
      .meta({
        description:
          "The exam's notice topics the change leaves out of the plan, by area: say them before the learner applies it",
      }),
    weeklyEvents: z
      .object({
        after: weekdaySchema.meta({
          description: "The weekday they move to, from Sunday (0) to Saturday (6)",
        }),
        before: weekdaySchema.meta({ description: "The weekday they were on" }),
        kind: z
          .enum(["challenge", "mock"])
          .meta({
            description: "`mock`: an exam's weekly mocks; `challenge`: the weekly challenges",
          }),
      })
      .optional()
      .meta({
        description:
          "The week's mocks or challenges move to another weekday, as a change to the learner's days moves them off a rest day",
      }),
  })
  .meta({ id: "PlanEffect" });

/**
 * A change to a plan as the learner sees it: the plan's own changes, and a change the buddy
 * proposed in the conversation.
 */
export const planChangeSchema = z
  .object({
    behind: z
      .object({
        canFocus: z
          .boolean()
          .meta({ description: "The plan has more than one area to choose where to focus" }),
        coveredAfter: z.number().min(0).max(1),
        coveredBefore: z.number().min(0).max(1),
        currentMinutes: z
          .int()
          .min(0)
          .meta({ description: "The learner's daily time, which covers coveredAfter" }),
        dailyMinutes: z
          .int()
          .nullable()
          .meta({
            description:
              "The daily time to offer: the one that covers the whole goal in depth again (fullDepth), else the most time a day; null when the learner already gives it",
          }),
        fullDepth: z.boolean(),
        measure: z
          .enum(["exam", "goal"])
          .meta({ description: "A share of the exam's questions and points, or of the goal" }),
      })
      .nullable()
      .meta({
        description:
          "For missedDays: falling behind made the plan cover less of its goal by its date. Offer that daily time, keeping the time with less depth, or choosing where to focus. Null when the date isn't at risk",
      }),
    canUndo: z
      .boolean()
      .meta({ description: "True while the plan is still as the change left it" }),
    createdAt: z.iso.datetime(),
    days: z
      .int()
      .nullable()
      .meta({ description: "For missedDays: the earlier days that left lessons, now first" }),
    effect: planEffectSchema.nullable(),
    id: z.uuid(),
    kind: z
      .string()
      .meta({
        description:
          "edited, testedOut, missedDays, estimateUpdated or resumed; keep unknown kinds",
      }),
    lessonsSkipped: z
      .int()
      .min(0)
      .meta({ description: "Plan items a test-out skipped, the same count as its result" }),
    officialDate: z
      .object({
        date: isoDateSchema,
        source: z
          .string()
          .nullable()
          .meta({ description: "The address of the notice that sets it" }),
      })
      .nullable()
      .meta({
        description:
          "The exam day the notice officially sets, when the change moves the goal's date off it. Say it with the change and label applying it as keeping the learner's own date anyway. Null otherwise",
      }),
    operations: z.array(anyPlanOperationSchema),
    reason: z
      .string()
      .nullable()
      .meta({
        description:
          "The sentence to show as written when an AI or a proposal wrote it; null when the client says it from kind, operations and effect, as for every change read from the learner's words (`source: planEdit`, the buddy's or the plan page's), so its card says what it does, never what was asked",
      }),
    seen: z
      .boolean()
      .meta({ description: 'The learner said "Got it" to it, so the plan no longer shows it' }),
    source: z
      .string()
      .meta({ description: "learner, planEdit, tutor, system, or the part that proposed it" }),
    status: z
      .enum(PLAN_CHANGE_STATUSES)
      .meta({
        description:
          "proposed waits for the learner's answer; replaced: a newer change about the same thing (the time, the date, the focus, the exam's notice) replaced it before they answered, so it can't be applied",
      }),
    todaySession: z
      .enum(["changed", "unchanged"])
      .nullable()
      .meta({
        description:
          "For a change the learner made or applied: changed when today's session took it right away, unchanged when today's session stays as it was (underway or done), so the change starts on the next study day. Null otherwise",
      }),
  })
  .meta({ id: "PlanChange" }) satisfies z.ZodType<PlanChangeView>;
