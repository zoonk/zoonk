import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { finishedChapterSchema } from "@zoonk/core/sessions/completion-contract";
import { progressCelebrationShape } from "@zoonk/core/sessions/progress-celebration";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { bankQuestionSchema, probabilitySchema, skillIdSchema } from "./learner";

export const nothingToSkipSchema = z
  .object({ status: z.literal("nothingToSkip") })
  .meta({
    description: "No lessons remain for a test-out to skip. Open the chapter instead.",
    id: "NothingToSkip",
  });

export const chapterTestOutResponseSchema = z
  .object({
    chapterId: uuidSchema(),
    needsItems: z
      .array(skillIdSchema)
      .meta({
        description:
          "Sampled skills without their share of questions yet: POST .../test-out/generations writes them when the learner asks",
      }),
    passMark: probabilitySchema,
    questions: z
      .array(bankQuestionSchema)
      .meta({
        description:
          "Four to eight, more the more lessons a pass skips, spread over the sampled skills (a chapter of few skills asks each several times); empty while `needsItems` lists any, so a test-out never runs on part of the chapter",
      }),
    questionsPerSkill: z
      .int()
      .min(0)
      .meta({ description: "How many questions each sampled skill gets" }),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "ChapterTestOut" });

export const testOutGenerationSchema = z
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
          "`ready`: GET the test-out now. `generating`: follow the run's stream until `testOutQuestionsReady`",
      }),
  })
  .meta({ id: "TestOutGeneration" });

export const chapterTestOutRecordSchema = z
  .object({
    canUndo: z
      .boolean()
      .meta({
        description:
          "Whether its plan change can still be undone through the goal's plan changes: the plan is exactly as the skip left it",
      }),
    changeId: uuidSchema()
      .nullable()
      .meta({ description: "The plan change that skipped its lessons; null when it skipped none" }),
    correct: z.int().min(0),
    lessonsSkipped: z
      .int()
      .min(0)
      .meta({ description: "The lessons its result said were off the plan" }),
    passed: z.boolean(),
    total: z.int().min(0),
    undone: z
      .boolean()
      .meta({ description: "The learner undid the skip: its lessons are back in the plan" }),
  })
  .meta({ id: "ChapterTestOutRecord" });

export const chapterTestOutResultSchema = z
  .object({
    ...progressCelebrationShape,
    changeId: uuidSchema()
      .nullable()
      .meta({
        description:
          "The plan change that skipped the lessons; undo it through the goal's plan changes. Null when nothing was skipped or the plan isn't built yet.",
      }),
    correct: z.number().int().min(0),
    finishedChapter: finishedChapterSchema,
    lessonsSkipped: z
      .int()
      .min(0)
      .meta({
        description:
          "The lessons it skipped, the count its plan change says: a topic still being written counts the lessons the plan teaches in its place",
      }),
    passed: z.boolean(),
    total: z.number().int().min(0),
  })
  .meta({ id: "ChapterTestOutResult" });
