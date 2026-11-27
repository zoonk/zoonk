import { type MistakeCause, type MistakeStatus } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { MAX_EXAM_QUESTIONS } from "../exams/mocks/mock-structure";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../learner/contract";
import { lessonStepAnswerSchema } from "../lesson-player/contract";
import { studyAnswerInputSchema } from "../sessions/contract";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const mistakeAvailabilitySchema = z.object({
  ready: z.number().int().min(0).meta({ description: "Open mistakes with practice material" }),
});

export type MistakeAvailability = z.infer<typeof mistakeAvailabilitySchema>;

export const mistakeListInputSchema = z
  .object({
    cause: z.enum(["gap", "misread", "trap", "time", "guess"] satisfies MistakeCause[]).optional(),
    goalId: uuidSchema().optional().meta({ description: "Only mistakes on this goal's skills" }),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
    skillId: uuidSchema().optional(),
    status: z.enum(["open", "fixed"] satisfies MistakeStatus[]).optional(),
    timeZone: answerTimeZoneSchema,
  })
  .strict();

export type MistakeListInput = z.infer<typeof mistakeListInputSchema>;

export const mistakePracticeInputSchema = z
  .object({
    blockId: uuidSchema().optional().meta({ description: "The day block with frozen mistake IDs" }),
    goalId: uuidSchema().optional().meta({ description: "Only mistakes on this goal's skills" }),
    includeAllFormats: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    mockId: uuidSchema()
      .optional()
      .meta({ description: "A finished mock whose mistakes can be practiced" }),
    skillId: uuidSchema()
      .optional()
      .meta({
        description: "Only this skill's mistakes (\"Practice this skill\"), within the goal's",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .refine(
    ({ blockId, mockId, skillId }) => !(blockId && mockId) && !((blockId || mockId) && skillId),
    { message: "Choose one practice scope" },
  );

export type MistakePracticeInput = z.infer<typeof mistakePracticeInputSchema>;

/** Normal notebook runs are short, while a mock run can hold all of its questions. */
export const MAX_PRACTICE_ANSWERS = 50;

const mistakePracticeAnswerCommon = z
  .object({
    attemptId: uuidSchema()
      .optional()
      .describe("Your id for this answer: sent again with it (a retry), it's recorded once"),
    run: z
      .object({
        answerIds: z
          .array(uuidSchema())
          .max(MAX_EXAM_QUESTIONS - 1)
          .meta({ description: "The run's earlier answers, as their answers returned them" }),
        blockId: mistakePracticeInputSchema.shape.blockId,
        goalId: uuidSchema()
          .optional()
          .meta({ description: "The goal the run practiced, when scoped" }),
      })
      .strict()
      .optional()
      .meta({
        description:
          "The run this answer is part of. The answer then counts the run toward today, as finishing it with every answer so far does, so a run left halfway still counts without a finish after each answer",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict();

export const mistakePracticeAnswerInputSchema = z
  .union([
    studyAnswerInputSchema.extend(mistakePracticeAnswerCommon.shape).strict(),
    itemAnswerInputSchema
      .omit({ answer: true, itemId: true })
      .extend({
        ...mistakePracticeAnswerCommon.shape,
        answer: z.union([lessonStepAnswerSchema, z.object({ dontKnow: z.literal(true) }).strict()]),
        attemptId: uuidSchema(),
        stepId: uuidSchema(),
      })
      .strict(),
  ])
  .meta({ id: "MistakePracticeAnswerInput" });

export type MistakePracticeAnswerInput = z.infer<typeof mistakePracticeAnswerInputSchema>;

export const mistakePracticeFinishInputSchema = z
  .object({
    answerIds: z
      .array(uuidSchema())
      .max(MAX_EXAM_QUESTIONS)
      .meta({
        description:
          "Every answer given in the run so far, as their answers returned them. Finish after each answer so a run left halfway still counts; each finish adds only the new answers to the same run",
      }),
    blockId: mistakePracticeInputSchema.shape.blockId,
    ended: z
      .boolean()
      .optional()
      .meta({ description: "True once, when the learner reached the end or stopped early" }),
    goalId: uuidSchema()
      .optional()
      .meta({ description: "The goal the run practiced, when scoped" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .refine(({ answerIds, blockId }) => answerIds.length > 0 || Boolean(blockId), {
    message: "Send at least one answer or a practice block",
    path: ["answerIds"],
  })
  .meta({ id: "MistakePracticeFinishInput" });

export type MistakePracticeFinishInput = z.infer<typeof mistakePracticeFinishInputSchema>;
