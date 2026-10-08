import { CHALLENGE_STATUSES, type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { BuddyGlasses } from "@zoonk/db";
import { z } from "zod";
import {
  logicalDateSchema,
  studyBlockDetailResponseSchema,
  studyBlockSchema,
} from "./study-sessions";
import { mockWrittenPartsSchema } from "./weekly-challenge";

const phaseSchema = z
  .object({ index: z.number().int().min(0), name: z.string() })
  .meta({ id: "CheckpointPhase" });

const kindSchema = z
  .enum(["boss", "finalBoss", "weekly"])
  .meta({ description: "A phase boss, the final boss or the weekly Big Challenge" });

const rewardSchema = z
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
  .meta({
    description: "What it's worth, said upfront: a boss pays when won",
    id: "CheckpointReward",
  });

export const checkpointResponseSchema = z
  .object({
    blockId: z.uuid(),
    checklist: z
      .array(z.enum(EXAM_DAY_CHECKLIST))
      .meta({ description: "Before a mock: keys to rehearse exam day, ticked off on the device" }),
    kind: kindSchema,
    mock: z.boolean().meta({ description: "An exam's weekly mock, in the exam's conditions" }),
    nextPhase: phaseSchema
      .nullable()
      .meta({ description: "The phase after this one, which a lost boss never locks" }),
    passMark: z.number().int().min(0).meta({ description: "Right answers needed to win" }),
    phase: phaseSchema.nullable(),
    planItemId: z
      .uuid()
      .nullable()
      .meta({ description: "The plan item it plays: its challenge, before and on its day" }),
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
    retry: z
      .enum(["open", "passed", "tomorrow"])
      .nullable()
      .meta({
        description:
          "A boss that wasn't won, as things stand now: a new try tomorrow (it finished today), open (back in the plan) or passed (a later try won)",
      }),
    reward: rewardSchema,
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

export const challengeResponseSchema = z
  .object({
    blockId: z
      .uuid()
      .nullable()
      .meta({
        description: "Today's block for it, or the last one it was played in; null before its day",
      }),
    call: z.boolean().meta({ description: "A language goal's boss: the unit's live call" }),
    canMove: z
      .boolean()
      .meta({
        description: '"Move to Monday": the weekly challenge before it starts, from today on',
      }),
    date: logicalDateSchema.nullable().meta({ description: "The day it's planned for" }),
    estimatedMinutes: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "About how long it takes: for a mock, learners' real pace on the exam's mocks (never more than `minutes`), the exam's own pace until that's known; `minutes` otherwise",
      }),
    examName: z.string().nullable(),
    fullLength: z
      .boolean()
      .meta({
        description:
          "A mock the length of the real exam; a short one is half of it. False outside mocks",
      }),
    goalId: z.uuid(),
    kind: kindSchema,
    minutes: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Time on the clock for a mock; about how long a checkpoint takes" }),
    mock: z.boolean().meta({ description: "An exam's weekly mock, in the exam's conditions" }),
    netScored: z.boolean().meta({ description: "Wrong answers cancel right ones" }),
    number: z.number().int().min(1).nullable().meta({ description: '"Mock exam 3"' }),
    passMark: z
      .number()
      .int()
      .min(0)
      .nullable()
      .meta({
        description: "Right answers that win a boss; a weekly challenge pays for finishing",
      }),
    phase: phaseSchema.nullable(),
    planItemId: z.uuid(),
    questions: z.number().int().min(0),
    reinforcementLessons: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Short lessons on what a lost duel missed, before its new try" }),
    rematch: z.boolean().meta({ description: "A boss lost on an earlier day, back again" }),
    reward: rewardSchema,
    sections: z.array(
      z.object({
        index: z.number().int().min(0),
        minutes: z.number().int().min(0),
        name: z.string().nullable(),
        questions: z.number().int().min(0),
      }),
    ),
    startTime: z
      .string()
      .nullable()
      .meta({ description: 'When the real exam starts, "HH:MM" in timeZone' }),
    status: z
      .enum(CHALLENGE_STATUSES)
      .meta({
        description:
          "upcoming before its day; ready or started on it; tried (a boss lost today); done; plusRequired (a mock outside the plan); waiting (today's session was planned without it)",
      }),
    timeZone: z.string().nullable(),
    title: z.string(),
    today: logicalDateSchema.meta({ description: "The learner's today, to say when it is" }),
    written: mockWrittenPartsSchema,
  })
  .meta({ id: "Challenge" }) satisfies z.ZodType<ChallengeView>;

export const challengeStartResponseSchema = z
  .object({
    blockId: z.uuid(),
    kind: z
      .enum(["checkpoint", "mock"])
      .meta({ description: "Played as a checkpoint (see /checkpoints) or a mock (see /mocks)" }),
    sessionId: z.uuid(),
  })
  .meta({ id: "ChallengeStart" });

export const challengeMoveResponseSchema = checkpointMoveResponseSchema
  .extend({
    planItemId: z
      .uuid()
      .nullable()
      .meta({ description: "The challenge on its new day: a dated plan item is a new one" }),
  })
  .meta({ id: "ChallengeMove" });

export const challengeUndoResponseSchema = z
  .object({
    planItemId: z
      .uuid()
      .nullable()
      .meta({ description: "The challenge back on its day: a dated plan item is a new one" }),
  })
  .meta({ id: "ChallengeMoveUndo" });
