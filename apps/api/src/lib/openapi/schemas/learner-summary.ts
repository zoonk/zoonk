import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { BuddyGlasses, BuddyKind, GoalKind, GoalStatus } from "@zoonk/db";
import { BELT_COLORS_ORDER } from "@zoonk/utils/belt-level";
import { z } from "zod";

const beltColorSchema = z.enum(BELT_COLORS_ORDER);
const millisecondsSchema = z.int().meta({ description: "Milliseconds since the epoch" });

const learnerSummaryGoalSchema = z
  .object({
    dailyMinutes: z.int(),
    id: z.uuid(),
    isActive: z.boolean().meta({ description: "The goal the tabs show" }),
    kind: z.enum(GoalKind),
    status: z.enum(GoalStatus),
    targetDate: z.iso.date().nullable(),
    targetLanguage: z.string().nullable(),
    title: z.string(),
  })
  .meta({ id: "LearnerSummaryGoal" });

const learnerSummarySchema = z
  .object({
    account: z.object({ email: z.string(), image: z.string().nullable(), name: z.string() }),
    activeGoalId: z.uuid().nullable().meta({ description: "The goal the tabs show" }),
    analytics: z
      .object({
        disabled: z.boolean().meta({ description: "The learner turned analytics off" }),
        goal: z
          .object({ kind: z.enum(GoalKind), phase: z.int().nullable() })
          .nullable()
          .meta({ description: "The active goal's kind and the plan phase it's in" }),
        plan: z.string().meta({ description: 'The subscription\'s plan, or "free"' }),
        username: z.string().nullable(),
      })
      .meta({ description: "What analytics attach to the learner's events" }),
    buddy: z
      .object({
        beltColor: beltColorSchema,
        energy: z
          .number()
          .nullable()
          .meta({ description: "Energy, or null until a day of study has passed" }),
        glasses: z.enum(BuddyGlasses),
        kind: z.enum(BuddyKind),
        name: z.string().nullable(),
        studiedToday: z.boolean(),
      })
      .meta({ description: "The buddy as the tabs draw it" }),
    day: z
      .object({ goalId: z.uuid(), localDate: z.iso.date() })
      .nullable()
      .meta({
        description:
          "The active goal's learner-local study day that `today` and `missions` describe (the night before's while a day carries over midnight); null without an active goal",
      }),
    goals: z
      .array(learnerSummaryGoalSchema)
      .meta({ description: "Goals not archived, the active one first, then oldest first" }),
    identity: z.object({
      expiresAt: millisecondsSchema.meta({ description: "When the session ends" }),
      isAnonymous: z.boolean().meta({ description: "A guest without an account yet" }),
      signedInAt: millisecondsSchema,
      userId: z.uuid(),
    }),
    level: z
      .object({ color: beltColorSchema, level: z.int() })
      .nullable()
      .meta({ description: "The belt and level, or null before any learning" }),
    missions: z
      .object({ done: z.int(), total: z.int() })
      .nullable()
      .meta({ description: "Today's missions, or null on a day without any" }),
    nextChangeAt: millisecondsSchema.meta({
      description:
        "When the summary changes without a write: the next local or UTC midnight (when the allowance starts over), the end of a day carried over from the night before, the subscription's next change or the session's end",
    }),
    places: z
      .object({
        exam: z.boolean(),
        mindMaps: z.boolean(),
        readyMistakes: z
          .int()
          .min(0)
          .meta({
            description:
              "How many of the active goal's notebook mistakes are ready to practice: a mistake becomes ready at the local midnight after it was made",
          }),
        speaking: z.boolean(),
      })
      .meta({ description: "The active goal's own places beside the tabs" }),
    readAt: millisecondsSchema,
    revision: z
      .string()
      .meta({
        description:
          "The learner's change counter as a decimal string: every write they can see raises it, so a higher one is newer",
      }),
    tier: z.enum(["free", "guest", "plus"]),
    timeZone: z.string().nullable().meta({ description: "The active goal's saved time zone" }),
    today: z
      .object({
        blocksLeft: z.int(),
        next: z
          .object({ minutes: z.number(), sessionId: z.uuid(), title: z.string().nullable() })
          .nullable(),
      })
      .nullable()
      .meta({ description: "Today's saved session, or null before it's saved" }),
  })
  .meta({ id: "LearnerSummary" }) satisfies z.ZodType<LearnerSummary>;

export const learnerSummaryResponseSchema = z
  .object({ summary: learnerSummarySchema })
  .meta({ id: "LearnerSummaryResponse" });
