import { CHALLENGE_STATUSES, type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { BuddyGlasses } from "@zoonk/db";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { z } from "zod";
import {
  checkpointEndedWithoutQuestionsSchema,
  checkpointKindSchema,
  checkpointPhaseSchema,
} from "./checkpoint-evidence";
import { mockLeftOutSchema } from "./mock-left-out";
import {
  logicalDateSchema,
  studyBlockDetailResponseSchema,
  studyBlockSchema,
} from "./study-sessions";
import { mockWrittenPartsSchema } from "./weekly-challenge";

const unknownSizeSchema = z.int().min(0).nullable();

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
    answeredQuestions: studyBlockDetailResponseSchema.shape.answeredQuestions,
    blockId: z.uuid(),
    checklist: z
      .array(z.enum(EXAM_DAY_CHECKLIST))
      .meta({ description: "Before a mock: keys to rehearse exam day, ticked off on the device" }),
    endedWithoutQuestions: checkpointEndedWithoutQuestionsSchema,
    kind: checkpointKindSchema,
    mock: z.boolean().meta({ description: "An exam's weekly mock, in the exam's conditions" }),
    nextPhase: checkpointPhaseSchema
      .nullable()
      .meta({ description: "The phase after this one, which a lost boss never locks" }),
    passMark: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "Right answers needed to win. A boss's duel is over once it's decided, won when they're reached (his shield breaks) or lost when its misses leave too few questions to reach them: ask no more questions and finish its block, the questions left unasked. A weekly challenge asks every question",
      }),
    phase: checkpointPhaseSchema.nullable(),
    planItemId: z
      .uuid()
      .nullable()
      .meta({ description: "The plan item it plays: its challenge, before and on its day" }),
    questions: studyBlockDetailResponseSchema.shape.questions,
    reinforcementLessons: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "Actual available lessons for this duel's misses, selected by the rematch scheduler; 0 before any misses or when none are available",
      }),
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
    call: z
      .object({
        goals: z
          .array(
            z.object({
              description: z
                .string()
                .meta({ description: "Why or how, in the learner's language" }),
              label: z.string().meta({ description: "What to get across, in `targetLanguage`" }),
            }),
          )
          .nullable()
          .meta({ description: "What to get across; null until the unit's call is written" }),
        level: z.enum(CEFR_LEVELS).meta({ description: "The level the learner speaks at now" }),
        minutes: z.number().int().min(0).meta({ description: "Minutes of talk" }),
        targetLanguage: z.string().meta({ description: "The language the call is in" }),
        title: z
          .string()
          .nullable()
          .meta({ description: "The call's name; null until the unit's call is written" }),
      })
      .nullable()
      .meta({
        description:
          "A language goal's phase or final boss: the unit's live call, which asks no questions (`questions` is 0). Free learners see the same call with `locked` true; null for every other challenge",
      }),
    canMove: z
      .boolean()
      .meta({
        description: '"Move to Monday": the weekly challenge before it starts, from today on',
      }),
    dailyLimitReached: z
      .boolean()
      .meta({
        description:
          "Today's study time is used up under the learner's daily limit, so a `ready` challenge can't start today: starting it is refused with `DAILY_LIMIT_REACHED`. False for every other status, and while `waitReason` says what comes first. A phase challenge is back on `nextStudyDate`, the first day within a week the plan's next run can put it on (say tomorrow when it's the day after `today`, else name the day; null: say the next session). `nextStudyDate` is null for an exam goal's phase challenges, whose day the plan's next run picks away from the exam's eve and its mock days, and for the weekly challenge, which doesn't come back on its own once its day is over: offer Move to Monday to keep it when `canMove`",
      }),
    date: logicalDateSchema.nullable().meta({ description: "The day it's planned for" }),
    estimatedMinutes: unknownSizeSchema.meta({
      description:
        "Estimated completion time from the learner's pace, capped at the mock's clock; minutes otherwise, null while its size is unknown. Display minutes as the canonical mock duration, the real time limit funded by the plan.",
    }),
    examName: z.string().nullable(),
    fullLength: z
      .boolean()
      .meta({
        description:
          "A mock the length of the real exam; a short one is half of it. False outside mocks",
      }),
    goalId: z.uuid(),
    kind: checkpointKindSchema,
    leftOut: mockLeftOutSchema,
    locked: z
      .boolean()
      .meta({
        description:
          "The learner needs Plus to start this challenge. Its content and completed feedback remain visible; an unfinished challenge has `status` `plusRequired`, and a completed language challenge keeps `status` `done` with `locked` true after Plus lapses. Starting rechecks the subscription",
      }),
    minutes: unknownSizeSchema.meta({
      description:
        "A mock's clock; otherwise about how long a checkpoint takes; null while its size is unknown",
    }),
    mock: z.boolean().meta({ description: "An exam's weekly mock, in the exam's conditions" }),
    netScored: z.boolean().meta({ description: "Wrong answers cost points (see `wrongPenalty`)" }),
    nextStudyDate: logicalDateSchema.nullable().meta({ description: "See `dailyLimitReached`" }),
    number: z.number().int().min(1).nullable().meta({ description: '"Mock exam 3"' }),
    passMark: unknownSizeSchema.meta({
      description:
        "Right answers that win a boss, null while its size is unknown; a call's goals got across, null until written. A weekly challenge pays for finishing",
    }),
    phase: checkpointPhaseSchema.nullable(),
    planItemId: z.uuid(),
    questions: unknownSizeSchema.meta({
      description: "Null while unknown; 0 for a call or a checkpoint with nothing to ask yet",
    }),
    recordings: unknownSizeSchema.meta({
      description:
        "Recordings a listening boss asks about, each played as in the exam; null for a saved recording offer while its recordings aren't picked yet, 0 for text or unknown kind",
    }),
    reinforcementLessons: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "Actual available lessons for the last lost duel's misses, selected by the rematch scheduler; 0 before a loss or when none are available",
      }),
    rematch: z.boolean().meta({ description: "A boss lost on an earlier day, back again" }),
    result: checkpointResponseSchema.shape.result.meta({
      description:
        "How a boss's last finished try went, so a won one shows its result instead of a new duel; null before its first try and for the weekly challenge",
    }),
    reward: rewardSchema,
    sections: z.array(
      z.object({
        index: z.number().int().min(0),
        minutes: z.number().int().min(0),
        name: z.string().nullable(),
        questions: z.number().int().min(0),
        tools: z
          .string()
          .nullable()
          .meta({ description: "What may be used or is given in it, in the notice's words" }),
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
          "upcoming before its day; ready or started on it; tried (a boss lost today); done; plusRequired (a mock outside the plan, or a phase challenge past a free exam plan's first week); waiting (today's session was planned without it: the next one has it); queued (a phase challenge whose lessons are done, after one still to win: it comes in the session after that one is won)",
      }),
    timeZone: z.string().nullable(),
    title: z.string(),
    today: logicalDateSchema.meta({ description: "The learner's today, to say when it is" }),
    topics: z
      .array(
        z.object({
          name: z.string(),
          subject: z
            .string()
            .nullable()
            .meta({ description: "Its subject's short name; null for a goal of one subject" }),
        }),
      )
      .meta({
        description:
          "What its questions ask about, in plan order: once its block is built, the topics of the questions it asks; before that, the topics its saved offer keeps. Empty without saved topics, for a mock, which lists its sections, and a language goal's call",
      }),
    waitReason: studyBlockSchema.shape.waitReason.meta({
      description:
        "Why today's block for it waits in today's saved session: earlier lessons (`lessons`) or an earlier phase challenge (`challenge`) are still pending or active. Read it only when `status` is `ready` or `started`. Starting it then answers 409 `EARLIER_FIRST` with the same `details.reason`, unless a 402 (Plus required) or 403 (today's study time is used up) refusal comes first. Completed or skipped work releases it. Null before today's session is saved and when nothing before it waits",
    }),
    written: mockWrittenPartsSchema,
    wrongPenalty: z
      .number()
      .min(0)
      .max(1)
      .meta({
        description:
          "The share of a right answer each wrong one takes away (1: a wrong answer cancels a right one); 0 when wrong answers cost nothing",
      }),
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

export const challengeGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description: "The run writing the questions: stream GET /generations/{generationId}/events",
      }),
    status: z
      .enum(["ready", "generating"])
      .meta({
        description:
          "`ready`: start the challenge now. `generating`: follow the run's stream until `challengeQuestionsReady`, then start it",
      }),
  })
  .meta({ id: "ChallengeGeneration" });

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
