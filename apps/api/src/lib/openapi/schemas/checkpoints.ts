import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { BuddyGlasses } from "@zoonk/db";
import { z } from "zod";
import { studyBlockDetailResponseSchema, studyBlockSchema } from "./study-sessions";

const phaseSchema = z
  .object({ index: z.number().int().min(0), name: z.string() })
  .meta({ id: "CheckpointPhase" });

export const checkpointResponseSchema = z
  .object({
    blockId: z.uuid(),
    checklist: z
      .array(z.enum(EXAM_DAY_CHECKLIST))
      .meta({ description: "Before a mock: keys to rehearse exam day, ticked off on the device" }),
    kind: z
      .enum(["boss", "finalBoss", "weekly"])
      .meta({ description: "A phase boss, the final boss or the weekly Big Challenge" }),
    mock: z.boolean().meta({ description: "An exam's weekly mock, in the exam's conditions" }),
    nextPhase: phaseSchema
      .nullable()
      .meta({ description: "The phase after this one, which a lost boss never locks" }),
    passMark: z.number().int().min(0).meta({ description: "Right answers needed to win" }),
    phase: phaseSchema.nullable(),
    questions: studyBlockDetailResponseSchema.shape.questions,
    reinforcementLessons: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Short lessons on what a lost duel missed, before the rematch" }),
    rematch: z.boolean().meta({ description: "A boss lost on an earlier day, back again" }),
    result: z
      .object({
        correct: z.number().int().min(0),
        passed: z.boolean(),
        total: z.number().int().min(0),
      })
      .nullable()
      .meta({ description: "How it went, once every question was answered and it finished" }),
    reward: z
      .object({
        badge: z
          .boolean()
          .meta({ description: 'A won boss puts a "Trap hunter" badge in the logbook' }),
        brainPower: z.number().int().min(0),
        glasses: z
          .enum(BuddyGlasses)
          .exclude(["round"])
          .nullable()
          .meta({ description: "Glasses it earns the first time" }),
        phaseComplete: z.boolean(),
      })
      .meta({ description: "What it's worth, said upfront: a boss pays when won" }),
    sessionId: z.uuid(),
    status: studyBlockSchema.shape.status,
    timeLimitMinutes: z.number().int().min(0).nullable(),
    title: z.string().nullable(),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "Checkpoint" });

export const checkpointMoveResponseSchema = z
  .object({
    changeId: z
      .uuid()
      .nullable()
      .meta({ description: "The plan change to undo it with; null before the plan is built" }),
    date: z.iso.date().meta({ description: "The learner-local day it moved to: the next Monday" }),
  })
  .meta({ id: "CheckpointMove" });
