import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { pointsMinimumSchema } from "../../library/exams/blueprint-contract";
import { writingZeroKindSchema, writtenGradingSchema } from "../../library/exams/written-grading";
import { withSavedNextStep } from "./_utils/writing-next-step";

export const MAX_ESSAY_CHARACTERS = 48_000;

const taskKey = z.string().min(1);
const lines = z.int().positive().nullable();
const points = z.number().positive().nullable();
export const writingUnitSchema = z.enum(["drill", "answer"]);

const writingTaskPosition = {
  distinctLines: z
    .boolean()
    .describe("Whether only one question in the written test has this stated line limit"),
  number: z.int().positive().describe("The first question number for this task in notice order"),
  total: z
    .int()
    .positive()
    .describe("The number of questions in the written test, counting repeats"),
};

export const writingTaskSchema = z
  .object({ lines, points, ...writingTaskPosition })
  .meta({ id: "WritingTask" });

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
    unit: writingUnitSchema,
  })
  .meta({ id: "WritingPrompt" });

export const writtenItemSchema = writingPromptSchema.extend({
  aspects: z.array(z.object({ criterionId: z.string(), description: z.string(), points })),
  assessedSkillIds: z.array(uuidSchema()).min(1),
  /** The learner's options it was written for; only learners with the same options get it. */
  chosenSubjects: z.array(z.string()).optional(),
  grading: writtenGradingSchema,
  /** The subject its question is on, so the next prompt of the task can take another. */
  subject: z.string().optional(),
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
    z.object({
      runId: z.string(),
      status: z.literal("writing"),
      unit: writingUnitSchema.optional(),
    }),
    z.object({
      returnsOn: z.iso.date(),
      status: z.literal("limitReached"),
      task: z
        .object({
          description: z.string(),
          distinctLines: writingTaskPosition.distinctLines.optional(),
          lines,
          minutes: z.int().positive(),
          number: writingTaskPosition.number.optional(),
          points,
          taskKey,
          total: writingTaskPosition.total.optional(),
          unit: writingUnitSchema,
        })
        .optional()
        .describe("The writing task and its estimated practice time in minutes"),
      unit: writingUnitSchema.optional(),
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
  unit: writingUnitSchema,
});

export const writingAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["available", "continue"]) }),
  z.object({ returnsOn: z.iso.date(), status: z.literal("tomorrow") }),
]);

export const writingNeedsChoiceSchema = z.object({
  choiceGroups: z
    .array(z.string())
    .min(1)
    .describe("The notice names of the exam choices this writing depends on"),
  status: z.literal("needsChoice"),
});

export type WritingNeedsChoice = z.infer<typeof writingNeedsChoiceSchema>;

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

export const writingScaleSchema = z.enum(["points", "levels"]);
export const writingDecimalsSchema = z.int().nonnegative();

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
      kind: z.enum(["criterion", "limit", "zero"]).optional(),
      quote: z.string().nullable(),
      text: z.string(),
      title: z.string().nullable().optional(),
    })
    .nullable(),
  progress: z.object({ fixed: z.array(z.string()), persists: z.array(z.string()) }).nullable(),
});

export const writingResultSchema = z
  .discriminatedUnion("kind", [
    feedback.extend({ kind: z.literal("levels") }),
    feedback.extend({
      content: writingRangeSchema,
      decimals: writingDecimalsSchema.optional(),
      deduction: writingRangeSchema.describe("Nonnegative points deducted for language"),
      kind: z.literal("points"),
      max: z.number().positive(),
      rows: z.array(
        z.object({
          decimals: writingDecimalsSchema.optional(),
          earned: z.number().describe("Points earned, or the lower end of a ranged criterion"),
          id: z.string(),
          max: z.number().positive(),
          range: writingRangeSchema.optional(),
        }),
      ),
      total: writingRangeSchema,
      zeroKind: writingZeroKindSchema.optional(),
      zeroReason: z.string().nullable(),
    }),
  ])
  .meta({ id: "WritingResult" });

export const writtenAnswerSchema = z.object({
  conditions: writingConditionsSchema,
  grade: writingResultSchema.transform(withSavedNextStep),
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
