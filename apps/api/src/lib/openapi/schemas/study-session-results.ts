import { milestoneSchema, missionSchema } from "@zoonk/core/sessions/completion-contract";
import { MasteryState, StudySessionStatus } from "@zoonk/db";
import { z } from "zod";
import { extraTimeSchema, logicalDateSchema } from "./study-sessions";

const idSchema = z.uuid();
const masteryStateSchema = z.enum(MasteryState);

const beltSchema = z.object({
  bpPerLevel: z.number().int(),
  bpToNextLevel: z.number().int(),
  color: z.string(),
  isMaxLevel: z.boolean(),
  level: z.number().int(),
  progressInLevel: z.number().int(),
});

export const studySessionSummaryResponseSchema = z
  .object({
    accuracy: z.number().min(0).max(1).nullable(),
    belt: z
      .object({
        after: beltSchema,
        before: beltSchema,
        colorChanged: z.boolean(),
        stripesGained: z.number().int(),
      })
      .nullable(),
    bestStreak: z
      .number()
      .int()
      .min(0)
      .meta({ description: "The most right answers in a row on new or due material" }),
    brainPower: z.number().int().min(0),
    buddyAte: z.object({
      fixes: z.number().int().min(0),
      newIdeas: z.number().int().min(0),
      reviews: z.number().int().min(0),
    }),
    capsulesSealed: z.array(
      z.object({
        lessonId: idSchema,
        opensOn: logicalDateSchema.nullable(),
        title: z.string().nullable(),
      }),
    ),
    ceremony: milestoneSchema.nullable().meta({ description: "At most one ceremony per session" }),
    comesBack: z.array(z.object({ date: logicalDateSchema, skills: z.number().int().min(0) })),
    correct: z.number().int().min(0),
    energy: z.object({ after: z.number(), before: z.number() }).nullable(),
    extraTime: extraTimeSchema,
    finished: z
      .boolean()
      .meta({
        description:
          'Every block is done or skipped. False right after "Stop for today": the rest of the session waits to be picked up',
      }),
    fullMeal: z.boolean(),
    minutes: z.number().int().min(0),
    missions: z.array(missionSchema),
    mistakesSaved: z.number().int().min(0),
    netScore: z
      .number()
      .int()
      .nullable()
      .meta({
        description:
          "Right minus wrong on the session's net-scored questions (Cebraspe practice and swipe capsules); null without them",
      }),
    newCards: z.array(z.object({ description: z.string(), name: z.string(), skillId: idSchema })),
    preparation: z.object({ after: z.number().nullable(), before: z.number().nullable() }),
    questions: z.number().int().min(0),
    sessionId: idSchema,
    skillsMoved: z.array(
      z.object({
        from: masteryStateSchema,
        name: z.string(),
        skillId: idSchema,
        to: masteryStateSchema,
      }),
    ),
    status: z.enum(StudySessionStatus),
    tomorrow: z.object({ title: z.string() }).nullable(),
    topHyperdrive: z.number().int().min(0),
  })
  .meta({ id: "StudySessionSummary" });
