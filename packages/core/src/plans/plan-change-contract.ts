import { z } from "zod";
import { examDocumentSchema } from "../exams/exam-document";
import { anyPlanOperationSchema } from "./plan-contract";
import { planEffectSchema } from "./plan-effect-contract";
import { type PlanChangeView } from "./plan-view-contract";

const isoDateSchema = z.iso.date();

/**
 * The source of a change the exam's notice brings: research read the notice after the learner saw
 * their plan, or a check found a new or corrected notice. Clients answer it with Apply or "Keep
 * mine".
 */
export const NOTICE_SOURCE = "notice";

/**
 * The source of a proposal to move the plan's phase dates (`fitPhaseDates`): lessons written since
 * the learner saw them take more or less time than planned, and keeping the dates leaves lessons
 * out by the goal's date. Clients answer it with Apply or "Keep mine", like the notice's.
 */
export const PHASE_DATES_SOURCE = "phaseDates";

/**
 * The same statuses as the database's, listed here so clients can parse a change. `replaced`: a
 * proposal a newer change about the same thing replaced before the learner answered it.
 */
const PLAN_CHANGE_STATUSES = ["proposed", "applied", "declined", "undone", "replaced"] as const;

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
        fittingDate: isoDateSchema
          .nullable()
          .meta({
            description:
              "When no daily time covers a goal that isn't an exam: the date the learner's time covers it all by, offered instead of more time (setTargetDate)",
          }),
        fullDepth: z.boolean(),
        maximumShare: z
          .number()
          .min(0)
          .max(1)
          .nullable()
          .meta({
            description:
              "When no daily time covers the goal (fullDepth false): the share dailyMinutes, the most time a day, covers by the date",
          }),
        measure: z
          .enum(["exam", "goal"])
          .meta({ description: "A share of the exam's questions and points, or of the goal" }),
      })
      .nullable()
      .meta({
        description:
          "For missedDays: falling behind made the plan cover less of its goal by its date (coveredBefore to coveredAfter, as the missed days left it). Offer that daily time, keeping the time with less depth, or choosing where to focus. On Today, the choices (dailyMinutes, fullDepth, maximumShare, fittingDate, canFocus) are the plan's as it is now, the same the plan's feasibility says. Null when the date isn't at risk",
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
    examDocument: examDocumentSchema,
    id: z.uuid(),
    kind: z
      .string()
      .meta({
        description:
          "edited, testedOut, missedDays, estimateUpdated, resumed, relearn (a miss in practice brought back the lessons of a topic taken as known; `effect.topicsAdded` names it) or coverageChanged (planned again as lessons were written or the learner studied, the plan teaches other topics by its date; `effect.topicsLeftOut` and `effect.topicsAdded` name them); keep unknown kinds",
      }),
    lessonsSkipped: z
      .int()
      .min(0)
      .meta({
        description:
          "Lessons a test-out skipped, as the plan's subjects and phases count them: a topic still being written counts the lessons the plan teaches in its place",
      }),
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
