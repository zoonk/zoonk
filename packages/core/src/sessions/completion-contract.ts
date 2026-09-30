import { type Milestone } from "@zoonk/db";
import { z } from "zod";
import { type CheckpointOutcome } from "../checkpoints/_utils/checkpoint-outcome";
import { type QuestionAnswer } from "./contract";
import { type Mission } from "./missions";

const LOGICAL_DATE_LENGTH = 10;

/** A checkpoint's result with each question's right answer and why, now that the duel is over. */
export type CheckpointResultView = CheckpointOutcome & {
  answers: {
    correctAnswer: QuestionAnswer;
    explanation: string | null;
    isCorrect: boolean;
    itemId: string;
    workedSteps: string[];
  }[];
};

/**
 * The moment after a block: a check mark, the Brain Power earned (the full meal included when it
 * just completed), one more step on the session bar, when a lesson comes back as a capsule, the
 * missions, and any milestone earned (the end of the session shows at most one as a ceremony).
 */
export type StudyBlockCompletion = {
  blockId: string;
  brainPower: number;
  capsulesOpened: number;
  checkpoint: CheckpointResultView | null;
  /** For lessons: the day their capsule opens, right when memory would start to fade. */
  comesBackOn: Date | null;
  correct: number;
  fullMeal: { bonus: number; paid: boolean };
  milestones: Milestone[];
  missions: Mission[];
  /**
   * Swipe capsules for exams where a wrong answer cancels a right one (Cebraspe) show the net
   * score: right minus wrong. Null for every other block.
   */
  netScore: number | null;
  nextBlockId: string | null;
  sessionBar: { completed: number; total: number };
  sessionCompleted: boolean;
  topHyperdrive: number;
  total: number;
};

const idSchema = z.uuid();
const countSchema = z.number().int().min(0);

/** A learner's answer to a session question, in any of the formats sessions grade. */
export const questionAnswerSchema = z
  .union([
    z.object({ selectedIndex: countSchema }),
    z.object({ isTrue: z.boolean() }),
    z.object({ dontKnow: z.literal(true) }),
    z.object({ matches: z.array(countSchema) }),
    z.object({ number: z.number() }),
  ])
  .meta({ id: "StudyQuestionAnswer" });

export const missionSchema = z
  .object({
    done: countSchema,
    kind: z.enum(["review", "somethingNew", "fixMistake"]),
    status: z.enum(["todo", "done", "nothingToday"]),
    total: countSchema,
  })
  .meta({ id: "StudyMission" });

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

/**
 * The moment after a session block, the same for question blocks and lessons: the lesson
 * player's completion returns it for a lesson that was one of the day's blocks.
 */
export const studyBlockCompletionSchema = z
  .object({
    blockId: idSchema,
    brainPower: countSchema.meta({ description: "Earned by the block, the full meal included" }),
    capsulesOpened: countSchema,
    checkpoint: checkpointResultSchema
      .nullable()
      .meta({ description: "A checkpoint's result with each right answer and why" }),
    comesBackOn: z.iso
      .date()
      .nullable()
      .meta({ description: "The learner-local day a lesson's capsule opens" }),
    correct: countSchema,
    fullMeal: z.object({ bonus: z.number().int(), paid: z.boolean() }),
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
    sessionBar: z.object({ completed: countSchema, total: countSchema }),
    sessionCompleted: z.boolean(),
    topHyperdrive: countSchema,
    total: countSchema,
  })
  .meta({ id: "StudyBlockCompletion" });

export type StudyBlockCompletionView = z.infer<typeof studyBlockCompletionSchema>;

/** The completion as it goes over the wire: instants in ISO, learner-local days as dates. */
export function serializeStudyBlockCompletion(
  completion: StudyBlockCompletion,
): StudyBlockCompletionView {
  return {
    ...completion,
    comesBackOn: completion.comesBackOn
      ? completion.comesBackOn.toISOString().slice(0, LOGICAL_DATE_LENGTH)
      : null,
    milestones: completion.milestones.map((milestone) => ({
      earnedAt: milestone.earnedAt.toISOString(),
      id: milestone.id,
      key: milestone.key,
      kind: milestone.kind,
      shownAt: milestone.shownAt?.toISOString() ?? null,
    })),
  };
}
