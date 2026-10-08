import { milestoneSchema, missionSchema } from "@zoonk/core/sessions/completion-contract";
import { BuddyGlasses, BuddyKind, MasteryState } from "@zoonk/db";
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
    buddy: z
      .object({ glasses: glassesSchema, kind: z.enum(BuddyKind), name: z.string().nullable() })
      .nullable()
      .meta({ description: "Null for learners without a buddy" }),
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
        missions: z.array(missionSchema),
      })
      .nullable()
      .meta({
        description:
          "Today's missions from the active goal's session, null until today's session is built (reading the buddy never builds it)",
      }),
  })
  .meta({ id: "BuddyStatus" });
