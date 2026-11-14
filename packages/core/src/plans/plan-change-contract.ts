import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { examDocumentSchema } from "../exams/exam-document";
import { anyPlanOperationSchema } from "./plan-contract";
import { planChangeQuoteSchema } from "./plan-decision-contract";
import { planEffectSchema } from "./plan-effect-contract";
import { type PlanChangeView } from "./plan-view-contract";

const isoDateSchema = z.iso.date();

export const NOTICE_SOURCE = "notice";

export const PHASE_DATES_SOURCE = "phaseDates";

/** The database's statuses, listed here so clients can parse a change. */
const PLAN_CHANGE_STATUSES = ["proposed", "applied", "declined", "undone", "replaced"] as const;

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
        measure: z
          .enum(["exam", "goal"])
          .meta({ description: "A share of the exam's questions and points, or of the goal" }),
      })
      .nullable()
      .meta({
        description:
          "For missedDays: falling behind made the plan cover less of its goal by its date (coveredBefore to coveredAfter, as the missed days left it, at currentMinutes a day). The learner's ways out are more time a day or, for a goal that isn't an exam, a later date (POST /v1/goals/{goalId}/plan/time-to-cover finds exactly the time or date that covers everything), keeping the time and covering less, or choosing where to focus (canFocus). Null when the date isn't at risk",
      }),
    canApply: z
      .boolean()
      .meta({
        description:
          "True for a proposed change that has an `effect`, on any day. Accepting it works the change out against today's plan: when that differs from `effect`, nothing is applied and the answer is the change still `proposed`, with today's `effect`",
      }),
    canUndo: z
      .boolean()
      .meta({ description: "True while the plan is still as the change left it" }),
    createdAt: z.iso.datetime(),
    days: z
      .int()
      .nullable()
      .meta({ description: "For missedDays: the earlier days that left lessons, now first" }),
    effect: planEffectSchema
      .nullable()
      .meta({
        description:
          "What applying the change does, previewed against the current plan; Today carries no proposal whose preview would change nothing. Null when the plan is not ready or its operations cannot apply, and then the change can't be applied",
      }),
    examDocument: examDocumentSchema,
    id: uuidSchema(),
    kind: z
      .string()
      .meta({
        description:
          "edited, testedOut, missedDays, estimateUpdated (automatic re-estimates from pace data or written lessons changed the net seen lesson count by more than one, so the plan allows for the time its lessons need), resumed, relearn (a miss in practice brought back the lessons of a topic taken as known; `effect.topicsAdded` names it) or coverageChanged (placement answers changed which topics fit by the date; `effect.topicsLeftOut` and `effect.topicsAdded` name them); keep unknown kinds",
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
          "The exam day the notice officially sets, when the change moves the goal's date off it, so applying it keeps the learner's own date instead of the official one. Null otherwise",
      }),
    operations: z.array(anyPlanOperationSchema),
    quote: planChangeQuoteSchema
      .nullable()
      .meta({
        description:
          "Which numbers `effect` shows. Accepting a proposal sends it back; it changes when accepting finds today's numbers differ. Null for a change with no worked-out `effect`",
      }),
    reason: z
      .string()
      .nullable()
      .meta({
        description:
          "Why the change is proposed or was made, written by an AI or a proposal in the learner's language. Null for every change read from the learner's words (`source: planEdit`, the buddy's or the plan page's), which `kind`, `operations` and `effect` describe in full",
      }),
    seen: z.boolean().meta({ description: "True once the learner marked it as seen" }),
    source: z
      .string()
      .meta({ description: "learner, planEdit, tutor, system, or the part that proposed it" }),
    status: z
      .enum(PLAN_CHANGE_STATUSES)
      .meta({
        description:
          "proposed waits for the learner's answer, and waits again after they apply it and undo it, except a Focus test proposal; undone: the learner undid a Focus test proposal or a change that applied without waiting for their answer (their own, a test-out); replaced: a newer change about the same thing (the time, the date, the focus, the exam's notice) replaced it before they answered, or waits in its place when they undo it, so it can't be applied",
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
