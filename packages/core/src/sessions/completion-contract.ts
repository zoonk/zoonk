import { type Milestone } from "@zoonk/db";
import { z } from "zod";
import { type CheckpointOutcome } from "../checkpoints/_utils/checkpoint-outcome";
import { type QuestionAnswer } from "./contract";
import { type Mission } from "./missions";
import { FIRST_STEP_KINDS, MISSION_KINDS } from "./missions/catalog";
import { type Reached, reachedSchema } from "./reached";

const LOGICAL_DATE_LENGTH = 10;

export type CheckpointResultView = CheckpointOutcome & {
  answers: {
    correctAnswer: QuestionAnswer;
    explanation: string | null;
    isCorrect: boolean;
    itemId: string;
    workedSteps: string[];
  }[];
};

/** Offer once after the qualifying lesson streak, for that lesson's planned chapter. */
export type TestOutOffer = {
  chapterId: string;
  chapterTitle: string;
  goalId: string;
  /** Includes pending lessons elsewhere that teach only the same skills. */
  lessonsLeft: number;
};

export type StudyBlockCompletion = {
  blockId: string;
  brainPower: number;
  capsulesOpened: number;
  /** The one milestone the block earned that gets a full-screen moment right after it. */
  ceremony: Milestone | null;
  checkpoint: CheckpointResultView | null;
  /** For lessons: the day their capsule opens, right when memory would start to fade. */
  comesBackOn: Date | null;
  completedMissions: Mission["kind"][];
  correct: number;
  fullMeal: { bonus: number; paid: boolean };
  milestones: Milestone[];
  missions: Mission[];
  /** Right minus wrong for net-scored swipe capsules; null for other blocks. */
  netScore: number | null;
  nextBlockId: string | null;
  /** Only the settling request reports newly reached levels; retries report none. */
  reached: Reached;
  sessionBar: { completed: number; total: number };
  sessionCompleted: boolean;
  /** Null unless the lesson completes a qualifying streak and the chapter has lessons left to skip. */
  testOutOffer: TestOutOffer | null;
  topHyperdrive: number;
  total: number;
};

const idSchema = z.uuid();
const countSchema = z.number().int().min(0);

/** Off-session activity points exclude the separately displayed daily mission reward. */
export const activityBrainPowerSchema = z
  .int()
  .min(0)
  .meta({
    description: "Brain Power earned by the activity itself, excluding the daily mission bonus.",
  });

export const questionAnswerSchema = z
  .union([
    z.object({ selectedIndex: countSchema }),
    z.object({ selectedIndexes: z.array(countSchema) }),
    z.object({ isTrue: z.boolean() }),
    z.object({ dontKnow: z.literal(true) }),
    z.object({ matches: z.array(countSchema) }),
    z.object({ number: z.number() }),
    z.object({ text: z.string() }),
    z.object({ order: z.array(countSchema) }),
  ])
  .meta({ id: "StudyQuestionAnswer" });

export const missionOpensSchema = z
  .discriminatedUnion("kind", [
    z.object({ blockId: idSchema, kind: z.literal("block") }),
    z.object({ kind: z.literal("mistakesPractice") }),
    z.object({ kind: z.literal("pattern"), patternId: idSchema }),
    z.object({ kind: z.literal("pronunciation") }),
    z.object({ chapterId: idSchema, kind: z.literal("call") }),
    z.object({ kind: z.literal("buddy") }),
    z.object({ areaId: idSchema, kind: z.literal("areaPractice") }),
    z.object({ kind: z.literal("mockChooser") }),
  ])
  .meta({
    description:
      "Where the learner can complete the mission or first step. Opening this target is an explicit learner action; reading missions never starts generation.",
    id: "StudyMissionOpens",
  });

const missionDetailSchema = z
  .object({
    areaTitle: z.string().optional(),
    chapterTitle: z.string().optional(),
    count: countSchema.optional(),
    minutes: z.number().min(0).optional(),
    patternTitle: z.string().optional(),
    rematch: z.boolean().optional(),
    title: z
      .string()
      .optional()
      .meta({
        description:
          "For a mission done in the day's blocks: the queue title of its next block still to do, read with the mission, so a chapter's mission names the lesson it still asks.",
      }),
  })
  .meta({ id: "StudyMissionDetail" });

export const firstStepKindSchema = z.enum(FIRST_STEP_KINDS);

export const missionWaitReasonSchema = z
  .enum(["challenge", "lessons"])
  .meta({
    description:
      "Why the block this mission or first step opens can't start yet: a phase challenge waits for the day's lessons before it, or for the challenge before it. Absent once it can start.",
  });

export const missionSchema = z
  .object({
    detail: missionDetailSchema.optional(),
    done: countSchema,
    firstStep: z.boolean().optional(),
    kind: z.enum(MISSION_KINDS),
    minutes: z
      .number()
      .min(0)
      .optional()
      .meta({
        description:
          "About how many minutes a mission still to do asks: the planned minutes of its unfinished blocks (a waiting challenge's included), or an estimate for work outside the day's blocks. Absent once done.",
      }),
    opens: missionOpensSchema.optional(),
    status: z.enum(["todo", "done"]),
    total: countSchema,
    waitReason: missionWaitReasonSchema.optional(),
  })
  .meta({
    description:
      "An achievable mission picked when the day's session is built and stored with that session. Reads update progress against the saved target; unavailable kinds are omitted, and an unfinished mission whose planned anchor was removed is dropped. Completed missions remain. A session still running after midnight keeps its original missions. Optional target and detail fields let clients open and describe each kind alongside the progress counters.",
    id: "StudyMission",
  });

export const missionMomentSchema = z
  .object({
    completed: z
      .array(z.enum(MISSION_KINDS))
      .meta({ description: "The day's missions this activity completed" }),
    fullMeal: z
      .object({ bonus: z.number().int(), paid: z.boolean() })
      .meta({ description: "Whether this activity paid the day's bonus for every mission done" }),
    missions: z
      .array(missionSchema)
      .meta({ description: "The day's missions as they stand after the activity" }),
  })
  .meta({
    description:
      "What an activity outside the day's blocks (a notebook practice, a pattern drill, a pronunciation round, a call, a question to the buddy) did to the day's missions, for the end of its screen. Null when it completed none.",
    id: "StudyMissionMoment",
  });

export type MissionMomentView = z.infer<typeof missionMomentSchema>;

export const milestoneSchema = z
  .object({
    earnedAt: z.iso.datetime(),
    id: idSchema,
    key: z.string(),
    kind: z.enum(["badge", "belt", "glasses", "buddyStage"]),
    shownAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "Milestone" });

const checkpointResultSchema = z.object({
  answers: z.array(
    z.object({
      correctAnswer: questionAnswerSchema,
      explanation: z.string().nullable(),
      isCorrect: z.boolean(),
      itemId: idSchema,
      workedSteps: z
        .array(z.string())
        .meta({ description: "A math question's worked steps with the numbers it showed" }),
    }),
  ),
  correct: countSchema,
  kind: z.enum(["boss", "finalBoss", "weekly"]),
  passMark: countSchema,
  passed: z.boolean(),
  total: countSchema,
});

/** Lesson-player completion uses the same contract when the lesson belongs to a session block. */
export const studyBlockCompletionSchema = z
  .object({
    blockId: idSchema,
    brainPower: countSchema.meta({
      description: "Earned by the block, with the bonus for all offered missions when it just paid",
    }),
    capsulesOpened: countSchema,
    ceremony: milestoneSchema
      .nullable()
      .meta({
        description:
          "The one milestone this block earned that gets a full-screen moment right after it (a new belt, the buddy's next stage, new glasses); null otherwise and on a retry",
      }),
    checkpoint: checkpointResultSchema
      .nullable()
      .meta({ description: "A checkpoint's result with each right answer and why" }),
    comesBackOn: z.iso
      .date()
      .nullable()
      .meta({ description: "The learner-local day a lesson's capsule opens" }),
    completedMissions: z
      .array(z.enum(MISSION_KINDS))
      .meta({ description: "The day's missions this block completed, in the day's order" }),
    correct: countSchema,
    fullMeal: z
      .object({ bonus: z.number().int(), paid: z.boolean() })
      .meta({
        description:
          "Completing every offered mission earns the full 50 Brain Power, whether one, two or three were possible. Completion counts from any supported source, including work outside session blocks. An empty mission list has bonus 0 and never pays. Payment remains once per learner-local day across goals.",
      }),
    milestones: z.array(milestoneSchema),
    missions: z.array(missionSchema),
    netScore: z
      .number()
      .int()
      .nullable()
      .meta({
        description: "Right minus wrong, for net-scored (Cebraspe) swipe capsules and practice",
      }),
    nextBlockId: idSchema.nullable(),
    reached: reachedSchema.meta({
      description:
        "What the block took the learner to, for its moment to celebrate; nothing on a retry, which celebrates none of it again",
    }),
    sessionBar: z.object({ completed: countSchema, total: countSchema }),
    sessionCompleted: z.boolean(),
    testOutOffer: z
      .object({
        chapterId: idSchema,
        chapterTitle: z.string(),
        goalId: idSchema,
        lessonsLeft: countSchema.meta({
          description: "Lessons of the chapter still to do: what passing its test skips",
        }),
      })
      .nullable()
      .meta({
        description:
          "After a second lesson in a row of a chapter with every answer right: its test-out (GET /goals/{goalId}/chapters/{chapterId}/test-out), offered once. Null otherwise",
      }),
    topHyperdrive: countSchema,
    total: countSchema,
  })
  .meta({ id: "StudyBlockCompletion" });

export type StudyBlockCompletionView = z.infer<typeof studyBlockCompletionSchema>;

export type MilestoneView = z.infer<typeof milestoneSchema>;

export function serializeMilestone(milestone: Milestone): MilestoneView {
  return {
    earnedAt: milestone.earnedAt.toISOString(),
    id: milestone.id,
    key: milestone.key,
    kind: milestone.kind,
    shownAt: milestone.shownAt?.toISOString() ?? null,
  };
}

/** Serializes instants as ISO timestamps and learner-local days as dates. */
export function serializeStudyBlockCompletion(
  completion: StudyBlockCompletion,
): StudyBlockCompletionView {
  return {
    ...completion,
    ceremony: completion.ceremony ? serializeMilestone(completion.ceremony) : null,
    comesBackOn: completion.comesBackOn
      ? completion.comesBackOn.toISOString().slice(0, LOGICAL_DATE_LENGTH)
      : null,
    milestones: completion.milestones.map((milestone) => serializeMilestone(milestone)),
  };
}
