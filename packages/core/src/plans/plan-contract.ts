import { z } from "zod";
import { examChoicePickSchema } from "../exams/choices/exam-choice-contract";
import { LANGUAGE_ACTIVITY_TYPES } from "../language/activities/language-activities";
import { answerTimeZoneSchema } from "../learner/contract";
import { TOOL_CHOICES, TOOL_SYSTEMS } from "./plan-tools-contract";
import {
  AREA_STARTS,
  BASE_CHOICES,
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
const MAX_BASE_CHOICES = 200;

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
      .meta({ description: "The part as the learner says it, such as biology and chemistry" }),
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
        targetDate: z.iso
          .date()
          .nullable()
          .meta({
            description:
              "The new date, or null for none: after the learner's today (an earlier one is refused with 422 PLAN_CHANGE_INVALID `pastDate`) and at most 3,650 days after it (a later one with 422 TARGET_DATE_OUT_OF_RANGE)",
          }),
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
              "When an exam's written tests (an essay, a discursive test) are practiced: weekly (the default, spaced practice), biweekly (every other week and the final stretch) or finalWeeks (only the final weeks before the exam, which needs a date). The total practice stays the same",
          }),
        kind: z.literal("setWrittenCadence"),
      })
      .strict(),
    z
      .object({
        fullCourse: z
          .boolean()
          .meta({
            description:
              "true: study everything, even after the exam. Until the exam the plan stays the one its date shapes (what the exam asks most first, mocks, the final stretch); what doesn't fit before it goes on after the exam at the learner's time. false: the plan ends at the exam and leaves out what doesn't fit. Exams only: other goals study everything by having no date (`setTargetDate` with null)",
          }),
        kind: z.literal("setFullCourse"),
      })
      .strict(),
    z
      .object({
        choices: z
          .array(
            z
              .object({
                choice: z
                  .enum(BASE_CHOICES)
                  .meta({
                    description:
                      "deep: every lesson of it, core and depth, with the time what the plan keeps leaves. essential: its core, the first third of its lessons, before what builds on it (the default). quick: one short lesson that sums it up with a worked example. skip: none of it; what builds on it no longer waits for it, and its own topics leave the plan unless another skill teaches them. No choice ever pushes out a topic its core keeps",
                  }),
                skillId: z
                  .string()
                  .trim()
                  .min(1)
                  .meta({ description: "One of the plan's `bases`" }),
              })
              .strict(),
          )
          .min(1)
          .max(MAX_BASE_CHOICES),
        kind: z.literal("setBaseChoices"),
      })
      .strict()
      .meta({
        description:
          "How to study some of the plan's bases (`bases`: the skills its topics or final work build on, worth less to the goal than what builds on them). Bases not named keep their choice",
      }),
    z
      .object({ kind: z.literal("fitLessons") })
      .strict()
      .meta({
        description:
          "Brings in the lessons the learner's own time fits by the plan's date, at the time, date and pace their plan has: the plan is planned again from today as a change of theirs plans it, so topics its date left out, or more depth, come in where they fit. The plan offers it as `fitOffer` (GET /v1/goals/{goalId}/plan) when it adds lessons",
      }),
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

/**
 * Moves the plan's phase dates so its lessons fit by the goal's date. A refresh keeps the dates the
 * learner saw while lessons the Library writes take more or less time than planned; when keeping
 * them leaves lessons out that moving them fits in, core proposes this. Learners never send it.
 */
const fitPhaseDatesOperationSchema = z.object({ kind: z.literal("fitPhaseDates") });

/**
 * The option the learner takes of one of their exam's choices (ENEM's foreign language): the plan
 * studies it and no other option of that choice. Core builds it from `ExamChoiceInput` once the
 * option is checked against the exam's notice; learners never send it.
 */
const setExamChoiceOperationSchema = examChoicePickSchema.extend({
  kind: z.literal("setExamChoice"),
});

export const anyPlanOperationSchema = z.union([
  planOperationSchema,
  addSkillsOperationSchema,
  setToolsOperationSchema,
  followNoticeOperationSchema,
  setNoticeDateOperationSchema,
  fitPhaseDatesOperationSchema,
  setExamChoiceOperationSchema,
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
          'Accept or decline a proposed change, undo an applied one (a proposal the learner applied then waits for their answer again, status proposed, as before Apply; replaced when a newer proposal asks about the same thing), or mark an applied one as seen ("Got it"), so the plan stops showing it',
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "PlanChangeDecisionInput" });

export type PlanChangeDecisionInput = z.infer<typeof planChangeDecisionInputSchema>;
