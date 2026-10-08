import { z } from "zod";
import { LANGUAGE_ACTIVITY_TYPES } from "../language/activities/language-activities";
import { answerTimeZoneSchema } from "../learner/contract";
import { TOOL_CHOICES, TOOL_SYSTEMS } from "./plan-tools-contract";
import {
  AREA_STARTS,
  DAYS_PER_WEEK,
  DIFFICULTY_BIASES,
  MAX_DAILY_MINUTES,
  MIN_DAILY_MINUTES,
  PRACTICE_BIASES,
  WRITTEN_CADENCES,
  toolChoiceSchema,
} from "./planner/plan-state";

const MAX_OPERATIONS = 10;
const MAX_AREAS = 20;
const MAX_TOOLS = 20;
const MAX_PART_NAME_LENGTH = 80;
const MAX_PART_SKILLS = 200;

const areasSchema = z
  .array(z.string().trim().min(1))
  .max(MAX_AREAS)
  .meta({ description: "Area names exactly as the plan lists them" });

const dailyMinutesSchema = z.int().min(MIN_DAILY_MINUTES).max(MAX_DAILY_MINUTES);

const focusPartInputSchema = z
  .object({
    area: z.string().trim().min(1).meta({ description: "One of the operation's `areas`" }),
    name: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PART_NAME_LENGTH)
      .meta({ description: 'The part as the learner says it, such as "Biologia e Química"' }),
    skillIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(MAX_PART_SKILLS)
      .meta({ description: "The area's skills in the part, from the plan's graph" }),
  })
  .meta({ id: "PlanFocusPart" });

const activitiesSchema = z
  .array(z.enum(LANGUAGE_ACTIVITY_TYPES))
  .min(1)
  .max(LANGUAGE_ACTIVITY_TYPES.length);

/**
 * One change to how a plan is shaped. Every operation re-plans from today: past work never moves,
 * and the change can be undone. Weekdays count from Sunday (0) to Saturday (6).
 */
const planOperationSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("setDailyMinutes"), minutes: dailyMinutesSchema }).strict(),
    z
      .object({
        kind: z.literal("setWeekdayMinutes"),
        minutes: z.int().min(0).max(MAX_DAILY_MINUTES).meta({ description: "0 makes a rest day" }),
        weekdays: z
          .array(
            z
              .int()
              .min(0)
              .max(DAYS_PER_WEEK - 1),
          )
          .min(1)
          .max(DAYS_PER_WEEK),
      })
      .strict(),
    z
      .object({
        kind: z.literal("addLightWeek"),
        startDate: z.iso.date().meta({ description: "First day of a week at half the time" }),
      })
      .strict(),
    z
      .object({
        from: z.iso
          .date()
          .meta({ description: "The day the week's checkpoint or mock is planned" }),
        kind: z.literal("moveWeeklyEvent"),
        to: z.iso.date().meta({ description: "A later day to take it, within a week" }),
      })
      .strict(),
    z
      .object({
        kind: z.literal("setTargetDate"),
        targetDate: z.iso.date().nullable().meta({ description: "The new date, or null for none" }),
      })
      .strict(),
    z
      .object({
        areas: areasSchema,
        kind: z.literal("focusAreas"),
        parts: z
          .array(focusPartInputSchema)
          .max(MAX_AREAS)
          .optional()
          .meta({
            description:
              "Some of `areas` narrowed to the part the learner named (biology and chemistry of a sciences area that also holds physics): only those skills get the focus. Omitted, each area keeps the part it had; an area without a part is focused whole",
          }),
      })
      .strict(),
    z.object({ areas: areasSchema.min(1), kind: z.literal("skipAreas") }).strict(),
    z
      .object({ areas: areasSchema.min(1), kind: z.literal("restoreAreas") })
      .strict()
      .meta({
        description:
          "Brings these areas back to their usual place: skipped ones back in the plan, and ones given less time (`reduceAreas`) their usual time",
      }),
    z
      .object({ areas: areasSchema.min(1), kind: z.literal("reduceAreas") })
      .strict()
      .meta({
        description:
          "Less time for these areas, which stay in the plan (the learner wants less of them): they count half, so their depth and their share of the days go to the other areas first. A focus on one, or `restoreAreas`, gives it its usual time again",
      }),
    z
      .object({
        activities: activitiesSchema.meta({
          description: "Language practice to leave out of lessons, such as writing",
        }),
        kind: z.literal("skipActivities"),
      })
      .strict(),
    z.object({ activities: activitiesSchema, kind: z.literal("restoreActivities") }).strict(),
    z.object({ bias: z.enum(PRACTICE_BIASES), kind: z.literal("setPracticeBias") }).strict(),
    z.object({ bias: z.enum(DIFFICULTY_BIASES), kind: z.literal("setDifficultyBias") }).strict(),
    z
      .object({
        cadence: z
          .enum(WRITTEN_CADENCES)
          .meta({
            description:
              "When an exam's written tests (a redação, a discursive test) are practiced: weekly (the default, spaced practice), biweekly (every other week and the final stretch) or finalWeeks (only the final weeks before the exam, which needs a date). The total practice stays the same",
          }),
        kind: z.literal("setWrittenCadence"),
      })
      .strict(),
    z
      .object({
        areas: areasSchema.min(1),
        kind: z.literal("setAreaStart"),
        start: z
          .enum(AREA_STARTS)
          .meta({
            description:
              "pastBasics: these areas start past their foundations, at their higher bands (the learner said their lessons are too basic). basics: they start from their foundations again",
          }),
      })
      .strict(),
  ])
  .meta({ id: "PlanOperation" });

export type LearnerPlanOperation = z.infer<typeof planOperationSchema>;

/**
 * Adds lessons for skills the plan was missing, such as a prerequisite that mistakes revealed.
 * Other parts of core propose it; learners never send it.
 */
const addSkillsOperationSchema = z.object({
  kind: z.literal("addSkills"),
  skills: z.array(
    z.object({
      area: z.string().nullable().default(null),
      /** The skill it comes before; null puts it at the start of the plan's first phase. */
      beforeSkillId: z.string().nullable().default(null),
      lessons: z.int().min(1),
      name: z.string(),
      skillId: z.string(),
    }),
  ),
});

/**
 * What the learner said about some of the plan's tools on the "You'll use" card. A setup lesson an
 * earlier choice for the same tool added leaves the plan; `addSkills` in the same change adds the
 * new one. Core builds it from `PlanToolChoiceInput`; learners never send it.
 */
const setToolsOperationSchema = z.object({
  kind: z.literal("setTools"),
  tools: z.array(toolChoiceSchema).min(1),
});

/**
 * Makes the plan follow the exam's notice research read after the learner saw their plan: the
 * skills the notice expects and the plan missed, its subjects' names and topics, and its exam
 * weights. The graph it follows stays with the change (`noticeGraph` in its payload), so clients
 * only see which change it is. Core proposes it; learners never send it.
 */
const followNoticeOperationSchema = z.object({ kind: z.literal("followNotice") });

/**
 * Moves the plan to the exam day its notice gives (`estimated` when the notice isn't out and the
 * day is the likely one), which stays the notice's day: a later notice day may replace it again.
 * Core proposes it; learners never send it (their own date is `setTargetDate`).
 */
const setNoticeDateOperationSchema = z.object({
  estimated: z.boolean(),
  kind: z.literal("setNoticeDate"),
  targetDate: z.iso.date(),
});

export const anyPlanOperationSchema = z.union([
  planOperationSchema,
  addSkillsOperationSchema,
  setToolsOperationSchema,
  followNoticeOperationSchema,
  setNoticeDateOperationSchema,
]);

export type PlanOperation = z.infer<typeof anyPlanOperationSchema>;
export type AddedSkill = z.infer<typeof addSkillsOperationSchema>["skills"][number];

export const planChangeInputSchema = z
  .object({
    operations: z.array(planOperationSchema).min(1).max(MAX_OPERATIONS),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "PlanChangeInput" });

export type PlanChangeInput = z.infer<typeof planChangeInputSchema>;

export const planToolChoiceInputSchema = z
  .object({
    choice: z
      .enum(TOOL_CHOICES)
      .meta({
        description:
          "have: the learner has it. setup: a short lesson sets it up on `system`, before the first chapter that needs it. none: no install, the learner learns it with examples",
      }),
    system: z
      .enum(TOOL_SYSTEMS)
      .nullable()
      .default(null)
      .meta({
        description: "The learner's device, needed to set a tool up; phone means no computer",
      }),
    timeZone: answerTimeZoneSchema,
    tools: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(MAX_TOOLS)
      .meta({ description: "Tool names exactly as the plan lists them" }),
  })
  .strict()
  .refine((input) => input.choice !== "setup" || input.system !== null, {
    message: "Setting a tool up needs the learner's device",
    path: ["system"],
  })
  .meta({ id: "PlanToolChoiceInput" });

export type PlanToolChoiceInput = z.infer<typeof planToolChoiceInputSchema>;

export const planChangeDecisionInputSchema = z
  .object({
    status: z
      .enum(["applied", "declined", "undone", "seen"])
      .meta({
        description:
          'Accept or decline a proposed change, undo an applied one, or mark an applied one as seen ("Got it"), so the plan stops showing it',
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "PlanChangeDecisionInput" });

export type PlanChangeDecisionInput = z.infer<typeof planChangeDecisionInputSchema>;
