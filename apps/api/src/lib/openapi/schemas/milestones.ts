import { learningBuddySchema } from "@zoonk/core/profile/contract";
import {
  firstStepKindSchema,
  milestoneSchema,
  missionOpensSchema,
  missionSchema,
  missionWaitReasonSchema,
} from "@zoonk/core/sessions/completion-contract";
import { BuddyGlasses, MasteryState } from "@zoonk/db";
import { z } from "zod";
import { logicalDateSchema } from "./study-sessions";

const countSchema = z.number().int().min(0);

const glassesSchema = z.enum(BuddyGlasses);

const glassesProgressSchema = z
  .object({
    current: countSchema,
    earned: z.boolean(),
    glasses: glassesSchema,
    target: countSchema,
  })
  .meta({ id: "GlassesProgress" });

export const milestoneListResponseSchema = z
  .object({
    ceremony: milestoneSchema
      .nullable()
      .meta({ description: "The one milestone to celebrate next" }),
    earned: z.array(milestoneSchema),
    glasses: z.array(glassesProgressSchema),
  })
  .meta({ id: "MilestoneList" });

const weekNumbersSchema = z.object({
  averageMinutes: countSchema,
  daysStudied: z.array(logicalDateSchema),
  minutes: countSchema,
  questions: countSchema,
});

const buddyDietSchema = z
  .object({ fixes: countSchema, newIdeas: countSchema, reviews: countSchema })
  .meta({ id: "BuddyDiet" });

const firstStepWhenSchema = z.discriminatedUnion("kind", [
  z.object({ date: logicalDateSchema.optional(), kind: z.literal("challenge") }),
  z.object({ date: logicalDateSchema.optional(), kind: z.literal("essay") }),
  z.object({ kind: z.enum(["mistake", "review", "pattern", "call", "buddy", "lesson", "mock"]) }),
]);

const firstStepsSchema = z
  .object({
    completedOn: logicalDateSchema
      .optional()
      .meta({
        description:
          "The learner-local day the last step was done, present only on that day: the finished list is returned once more so it can say so, and is null from the next day.",
      }),
    done: countSchema,
    steps: z.array(
      z.object({
        kind: firstStepKindSchema,
        opens: missionOpensSchema.optional(),
        status: z.enum(["done", "today", "available", "later"]),
        waitReason: missionWaitReasonSchema.optional(),
        when: firstStepWhenSchema.optional(),
      }),
    ),
    total: countSchema,
  })
  .meta({
    description:
      "Account-level first steps applicable to the current goal, checked from the learner's history. Today marks a step included in the saved missions; available steps can be completed anytime. There is no separate reward. Once every applicable step is done the list stays for the rest of that learner-local day (completedOn), then is null; it is also null from the learner's fourteenth study day.",
    id: "BuddyFirstSteps",
  });

export const weeklyRecapResponseSchema = z
  .object({
    badges: z.array(milestoneSchema),
    buddyAte: buddyDietSchema,
    comparison: z.object({
      days: z.number().int(),
      minutes: z.number().int(),
      questions: z.number().int(),
    }),
    lastWeek: weekNumbersSchema,
    nextFocus: z.object({ title: z.string() }).nullable(),
    phasesFinished: z.array(z.object({ name: z.string(), phase: countSchema })),
    ready: z
      .boolean()
      .meta({ description: "True from Sunday, when the week's logbook is complete" }),
    turnaround: z
      .object({
        from: z.number().min(0).max(1),
        name: z.string(),
        points: z.array(
          z.object({ accuracy: z.number().min(0).max(1).nullable(), date: logicalDateSchema }),
        ),
        reason: z.enum(["gold", "solid", "practice"]),
        rememberedOn: z.array(logicalDateSchema),
        skillId: z.uuid(),
        state: z.enum(MasteryState),
        to: z.number().min(0).max(1),
      })
      .nullable(),
    week: weekNumbersSchema,
    weekEnd: logicalDateSchema,
    weekStart: logicalDateSchema,
  })
  .meta({ id: "WeeklyRecap" });

export const buddyStatusResponseSchema = z
  .object({
    belt: z.object({
      bpPerLevel: countSchema,
      bpToNextLevel: countSchema,
      color: z.string(),
      isMaxLevel: z.boolean(),
      level: countSchema,
      progressInLevel: countSchema,
      totalBrainPower: countSchema,
    }),
    buddy: learningBuddySchema,
    energy: z.object({
      current: z
        .number()
        .min(0)
        .max(100)
        .nullable()
        .meta({
          description:
            "Null until a day of study has passed: a new buddy has no Energy to show yet",
        }),
      state: z.enum(["napping", "awake", "glowing"]),
      studiedToday: z.boolean(),
    }),
    firstSteps: firstStepsSchema.nullable().optional(),
    glasses: z.array(glassesProgressSchema),
    nextStage: z
      .object({
        belt: z.string(),
        brainPowerToGo: countSchema,
        stage: z.enum(["baby", "young", "adult", "wise"]),
      })
      .nullable(),
    stage: z.enum(["baby", "young", "adult", "wise"]),
    thisWeek: buddyDietSchema,
    today: z
      .object({
        fullMeal: z.object({ bonus: countSchema, earned: z.boolean() }),
        goalId: z.uuid().meta({ description: "The goal whose session the missions are" }),
        localDate: logicalDateSchema.meta({
          description:
            "That session's learner-local date, the night before's while it carries over",
        }),
        missions: z.array(missionSchema),
      })
      .nullable()
      .meta({
        description:
          "The same saved missions as the active goal's current session, including its original day while it carries over midnight. Null until a current session exists; reading the buddy never builds a session or starts generation. The bonus is earned when any goal paid it for that session's learner-local date.",
      }),
  })
  .meta({ id: "BuddyStatus" });
