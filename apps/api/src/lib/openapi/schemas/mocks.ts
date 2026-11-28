import { examDocumentSchema } from "@zoonk/core/exams/document";
import { writingNeedsChoiceSchema } from "@zoonk/core/exams/essays/writing-contract";
import {
  type MockOptionView,
  type MockOptionsView,
  mockOptionSectionsSchema,
  mockShapeSchema,
} from "@zoonk/core/exams/mocks/contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { examMockSummarySchema } from "./exam-mock-summary";
import { mockPurposeSchema } from "./mock-exam";
import { mockLeftOutSchema } from "./mock-left-out";
import { mockSizeSourceSchema } from "./mock-parts";

export const preparingMockResponseSchema = z.object({ status: z.literal("preparing") });

const estimatedMinutesSchema = z
  .number()
  .int()
  .min(1)
  .meta({
    description:
      "About how long it usually takes: learners' real pace per answer on this exam's mocks, never more than `minutes`. Equal to `minutes` when there's no estimate for the whole mock (too few answers yet, or a written or spoken part, which no answer pace measures).",
  });

const mockOptionSchema = mockShapeSchema
  .extend({
    areas: z.array(z.string()).meta({ description: "The notice's subjects it asks, in its words" }),
    availability: writingNeedsChoiceSchema.optional(),
    covers: z
      .array(z.string())
      .nullable()
      .meta({
        description:
          "The exam day's sections it sits, by the notice's names (Listening, Reading), when it leaves one out that isn't a written part (IELTS's Speaking). Null when it sits every such section, and for a subject's mock",
      }),
    estimatedMinutes: estimatedMinutesSchema,
    leftOut: mockLeftOutSchema,
    minutes: z
      .number()
      .int()
      .min(1)
      .meta({ description: "The exam's time for it, which its clock gives" }),
    objectiveOnly: z.boolean().meta({ description: "The mock consists of objective questions" }),
    pacing: z.enum(["official", "practice"]).optional(),
    questions: z.number().int().min(0),
    sections: mockOptionSectionsSchema.optional(),
    written: z
      .array(z.string())
      .meta({
        description:
          "The written parts a full mock asks beside its questions, as the notice names them (the exam's own written questions, graded by their notice's criteria once it's over)",
      }),
  })
  .meta({ id: "MockOption" }) satisfies z.ZodType<MockOptionView>;

export const mockOptionsResponseSchema = z
  .object({
    access: z
      .enum(["open", "plusRequired"])
      .meta({
        description:
          "`plusRequired`: every mock exam comes with Plus, and the learner's plan doesn't include them",
      }),
    examDocument: examDocumentSchema,
    examName: z.string(),
    goalId: uuidSchema(),
    lastMock: examMockSummarySchema
      .nullable()
      .meta({
        description:
          "The goal's latest mock (the first of the exam's mocks list), to show how it went beside the options; null before the first",
      }),
    options: z
      .array(mockOptionSchema)
      .meta({
        description:
          "Each exam day and its standalone tests, then shorter mocks for each day and each objective subject",
      }),
    requested: z
      .object({ shape: mockShapeSchema, status: z.enum(["preparing", "ready"]) })
      .nullable()
      .meta({
        description: "The saved request and whether enough questions are available to start it",
      }),
    running: z
      .object({ id: uuidSchema(), purpose: mockPurposeSchema, shape: mockShapeSchema.nullable() })
      .nullable()
      .meta({
        description:
          "The mock taken any time the learner started and hasn't finished: continue it (GET /v1/mocks/{id}) before starting another",
      }),
    sizeSource: mockSizeSourceSchema,
  })
  .meta({ id: "MockOptions" }) satisfies z.ZodType<MockOptionsView>;

export const anytimeMockResponseSchema = z
  .object({
    id: uuidSchema()
      .nullable()
      .meta({ description: "The sitting ID, or null while questions are being prepared" }),
    status: z.enum(["started", "running", "preparing"]),
  })
  .meta({ id: "AnytimeMock" });

export const mockPlanOfferResultSchema = z
  .object({
    changeId: uuidSchema()
      .nullable()
      .meta({
        description: "The plan change it made, whose undo brings it back; null when unchanged",
      }),
    lessonsSkipped: z.number().int().min(0),
    status: z.enum(["applied", "unchanged"]),
  })
  .meta({ id: "MockPlanOfferResult" });

export const mockWritingQuerySchema = z
  .object({
    planItemId: uuidSchema()
      .optional()
      .meta({
        description:
          "A scheduled mock's plan item, for its paper; without it, the mock the learner last asked to take any time",
      }),
  })
  .meta({ id: "MockWritingQuery" });

export const mockWritingSchema = z
  .object({
    generationId: z
      .string()
      .min(1)
      .nullable()
      .meta({
        description:
          "The run writing the paper. GET /generations/{generationId}/events with the paper namespace streams the `mockPaper` steps `writeMockTexts` (only when it writes texts that several questions share), `writeMockQuestions`, `recordMockListening` (only for a paper with recordings), then `mockPaperReady`, or `workflowError` when the paper is still short. Null unless `status` is `writing`",
      }),
    namespace: z
      .string()
      .min(1)
      .nullable()
      .meta({
        description:
          "The paper's stream namespace within this run. Null unless `status` is `writing`",
      }),
    status: z
      .enum(["writing", "starting", "none"])
      .meta({
        description:
          "`writing`: the paper has a generation ID and stream namespace. `starting`: its run starts in a few seconds; ask again. `none`: nothing is writing it now (the mock is ready, or what was written fell short and the daily preparation goes on with it)",
      }),
  })
  .meta({ id: "MockWriting" });
