import { examDocumentSchema } from "@zoonk/core/exams/document";
import {
  type MockOptionView,
  type MockOptionsView,
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
    objectiveOnly: z
      .boolean()
      .meta({
        description:
          "The exam day also has a written part (an essay, a discursive test) this mock leaves out",
      }),
    questions: z.number().int().min(0),
    written: z
      .array(z.string())
      .meta({
        description:
          "The written parts a full mock asks beside its questions, as the notice names them (the exam's own essays, graded by its rubric once it's over)",
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
          "Each exam day in full, then half of each exam day, then each objective subject, biggest first",
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
    reason: z
      .enum(["alreadyIn", "cantMove"])
      .nullable()
      .meta({
        description:
          "Why a focus left the plan as it is: every lesson of the area is in already (`alreadyIn`), or it starts as early as what it builds on allows (`cantMove`)",
      }),
    status: z.enum(["applied", "unchanged"]),
  })
  .meta({ id: "MockPlanOfferResult" });
