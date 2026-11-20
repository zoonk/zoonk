import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { pointsMinimumSchema } from "../../library/exams/blueprint-contract";
import { writtenGradingSchema } from "../../library/exams/written-grading";

export const MAX_ESSAY_CHARACTERS = 48_000;

const taskKey = z.string().min(1);
const lines = z.int().positive().nullable();
const points = z.number().positive().nullable();
const unit = z.enum(["drill", "answer"]);

export const writingPromptSchema = z
  .object({
    charactersPerLine: z.int().positive(),
    criteria: z.array(z.object({ id: z.string(), name: z.string(), points })),
    keySource: z.enum(["notice", "publishedStandard", "practiceKey"]),
    lines,
    minimumWords: z.int().nonnegative(),
    partMinimum: z
      .object({ max: z.number().positive().nullable(), minimum: pointsMinimumSchema })
      .optional()
      .describe(
        "The written test’s overall minimum and maximum recorded when the prompt was issued",
      ),
    points,
    taskKey,
    title: z.string().min(1),
    unit,
  })
  .meta({ id: "WritingPrompt" });

export const writtenItemSchema = writingPromptSchema.extend({
  aspects: z.array(z.object({ criterionId: z.string(), description: z.string(), points })),
  assessedSkillIds: z.array(uuidSchema()).min(1),
  grading: writtenGradingSchema,
  taskBasis: z.string().optional(),
});

export const writingDraftSchema = z
  .object({
    admissionId: uuidSchema(),
    revision: z.int().nonnegative(),
    text: z.string().max(MAX_ESSAY_CHARACTERS),
  })
  .meta({ id: "WritingDraft" });

export const saveWritingDraftSchema = writingDraftSchema.strict().meta({ id: "SaveWritingDraft" });

export const writingStartInputSchema = z
  .object({
    previousAttemptId: uuidSchema()
      .optional()
      .describe("The graded attempt the learner chose to rewrite"),
  })
  .strict()
  .meta({ id: "WritingStartInput" });

export const writingStartSchema = z
  .discriminatedUnion("status", [
    z.object({ admissionId: uuidSchema(), status: z.literal("ready") }),
    z.object({ runId: z.string(), status: z.literal("writing") }),
    z.object({
      returnsOn: z.iso.date(),
      status: z.literal("limitReached"),
      task: z
        .object({
          description: z.string(),
          lines,
          minutes: z.int().positive(),
          points,
          taskKey,
          unit,
        })
        .optional()
        .describe("The writing task and its estimated practice time in minutes"),
    }),
  ])
  .meta({ id: "WritingStart" });

export const writingPacingSchema = z
  .object({
    minutes: z.int().positive(),
    source: z.enum(["official", "estimated", "personal", "practice"]),
  })
  .meta({ id: "WritingPacing" });

export const writingBlockSchema = z.object({
  admissionId: uuidSchema().nullable(),
  draft: writingDraftSchema.omit({ admissionId: true }).nullable(),
  taskKey,
  unit,
});

export const writingAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["available", "continue"]) }),
  z.object({ returnsOn: z.iso.date(), status: z.literal("tomorrow") }),
]);

const writingConditionsSchema = z.object({
  admissionId: uuidSchema(),
  estimatedLines: z.int().nonnegative(),
  origin: z.enum(["block", "mock"]),
  timed: z.boolean(),
  version: z.enum(["firstDraft", "rewrite"]),
});

export const writingRangeSchema = z
  .object({ high: z.number(), low: z.number() })
  .meta({ id: "WritingRange" });

const feedback = z.object({
  criteria: z.array(
    z.object({
      comment: z.string(),
      id: z.string(),
      level: z.enum(["missing", "partial", "strong", "complete"]),
      name: z.string(),
      quote: z.string().nullable(),
    }),
  ),
  errors: z.array(
    z.object({
      correction: z.string(),
      kind: z.string(),
      quote: z.string().min(1),
      start: z
        .int()
        .nonnegative()
        .describe("UTF-16 code units from the start of the submitted text"),
    }),
  ),
  estimatedLines: z
    .int()
    .nonnegative()
    .optional()
    .describe("Approximate lines in the submitted text"),
  ignoredFrom: z
    .int()
    .nonnegative()
    .nullable()
    .describe("UTF-16 offset where text exceeds the line limit"),
  nextStep: z
    .object({
      criterionId: z.string(),
      example: z.string().nullable(),
      quote: z.string().nullable(),
      text: z.string(),
    })
    .nullable(),
  progress: z.object({ fixed: z.array(z.string()), persists: z.array(z.string()) }).nullable(),
});

export const writingResultSchema = z
  .discriminatedUnion("kind", [
    feedback.extend({ kind: z.literal("levels") }),
    feedback.extend({
      content: writingRangeSchema,
      deduction: writingRangeSchema.describe("Nonnegative points deducted for language"),
      kind: z.literal("points"),
      max: z.number().positive(),
      rows: z.array(
        z.object({
          earned: z.number().describe("Points earned, or the lower end of a ranged criterion"),
          id: z.string(),
          max: z.number().positive(),
          range: writingRangeSchema.optional(),
        }),
      ),
      total: writingRangeSchema,
      zeroReason: z.string().nullable(),
    }),
  ])
  .meta({ id: "WritingResult" });

export const writtenAnswerSchema = z.object({
  conditions: writingConditionsSchema,
  grade: writingResultSchema,
  text: z.string(),
});

export type WritingDraft = z.infer<typeof writingDraftSchema>;
export type WritingPrompt = z.infer<typeof writingPromptSchema>;

export type WritingPacing = z.infer<typeof writingPacingSchema>;

export type WritingConditions = z.infer<typeof writingConditionsSchema>;
export type WritingTaskSummary = NonNullable<
  Extract<z.infer<typeof writingStartSchema>, { status: "limitReached" }>["task"]
>;

export type WritingResult = z.infer<typeof writingResultSchema>;

export const writingBlockInputSchema = z.strictObject({ taskKey: z.string().min(1).optional() });
