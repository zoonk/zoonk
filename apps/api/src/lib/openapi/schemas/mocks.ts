import { examDocumentSchema } from "@zoonk/core/exams/document";
import {
  type MockOptionView,
  type MockOptionsView,
  PLACEMENT_MOCK_LENGTHS,
  type PlacementMockOptionView,
  mockShapeSchema,
} from "@zoonk/core/exams/mocks/contract";
import { z } from "zod";
import { mockPurposeSchema } from "./mock-exam";
import { mockLeftOutSchema } from "./mock-left-out";
import { mockSizeSourceSchema } from "./mock-parts";

const estimatedMinutesSchema = z
  .number()
  .int()
  .min(1)
  .meta({
    description:
      "About how long it takes: learners' real pace on this exam's mocks, or the exam's own pace until there's enough of it; never more than `minutes`",
  });

const mockOptionSchema = mockShapeSchema
  .extend({
    areas: z.array(z.string()).meta({ description: "The notice's subjects it asks, in its words" }),
    covers: z
      .array(z.string())
      .nullable()
      .meta({
        description:
          "The exam day's sections it sits, by the notice's names (Listening, Reading), when it leaves one out that isn't a written part (IELTS's Speaking): say what it covers. Null when it sits every such section, and for a subject's mock",
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

const placementMockOptionSchema = z
  .object({
    areas: z
      .array(z.string())
      .meta({ description: "The notice's subjects it asks: every one, or the ones worth most" }),
    coversAllAreas: z
      .boolean()
      .meta({
        description:
          "It asks every subject the plan has; a short one may leave the smallest to the first days' questions",
      }),
    estimatedMinutes: estimatedMinutesSchema,
    length: z.enum(PLACEMENT_MOCK_LENGTHS),
    minutes: z
      .number()
      .int()
      .min(1)
      .meta({ description: "The exam's time for it, which its clock gives" }),
    questions: z.number().int().min(1),
  })
  .meta({ id: "PlacementMockOption" }) satisfies z.ZodType<PlacementMockOptionView>;

export const mockOptionsResponseSchema = z
  .object({
    access: z
      .enum(["open", "plusRequired"])
      .meta({
        description:
          "`plusRequired`: every mock exam comes with Plus (the placement one included); show the options with what it takes",
      }),
    examDocument: examDocumentSchema,
    examName: z.string(),
    goalId: z.uuid(),
    options: z
      .array(mockOptionSchema)
      .meta({
        description:
          "Each exam day in full, half of the day in turn, then each objective subject, biggest first",
      }),
    placement: z
      .object({
        mock: z
          .object({ id: z.uuid(), status: z.enum(["finished", "running"]) })
          .nullable()
          .meta({ description: "The goal's placement mock, once started" }),
        options: z
          .array(placementMockOptionSchema)
          .meta({
            description:
              "Its lengths, shortest first: a quick check, about half an hour, about an hour (fewer when two would ask as many questions)",
          }),
        recommended: z
          .enum(PLACEMENT_MOCK_LENGTHS)
          .meta({ description: "The length to suggest first" }),
      })
      .nullable()
      .meta({
        description:
          "A diagnostic mock in the exam's format, taken in onboarding instead of the quick placement (POST with `purpose: placement` and a `length`): its questions spread over every subject's topics set where the plan starts. Null when the exam has no questions to ask",
      }),
    running: z
      .object({ id: z.uuid(), purpose: mockPurposeSchema, shape: mockShapeSchema.nullable() })
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
    examQuestions: z
      .number()
      .int()
      .min(0)
      .optional()
      .meta({ description: "For `short`: the questions of what was picked, in the real exam" }),
    id: z
      .uuid()
      .nullable()
      .meta({
        description: "The mock's id (GET /v1/mocks/{id}); null for needsQuestions and short",
      }),
    limit: z
      .enum(["day", "month", "total"])
      .nullable()
      .optional()
      .meta({
        description:
          "For `short`: the plan's fair use for new mock questions is used for the day or the month, so new ones can be written once it renews; null when there's nothing more to write now",
      }),
    minutes: z
      .number()
      .int()
      .min(0)
      .optional()
      .meta({ description: "For `short`: the mock's time for the questions it can ask" }),
    questions: z
      .number()
      .int()
      .min(0)
      .optional()
      .meta({ description: "For `short`: the questions the mock can ask now" }),
    status: z
      .enum(["started", "running", "needsQuestions", "short"])
      .meta({
        description:
          "`started`: the mock runs, its first section's clock going. `running`: one was running already; continue it. `needsQuestions`: the shared bank is short of questions the learner never answered and their plan can have new ones written: POST /goals/{goalId}/mocks/generations, follow the run, then start again (with `acceptFewer` after the run). `short`: the bank holds well under the questions picked and none can be written now: tell the learner how many it asks of the exam's and in how long, and start it with `acceptFewer` if they want",
      }),
  })
  .meta({ id: "AnytimeMock" });

export const mockQuestionsGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description: "The run writing the questions: stream GET /generations/{generationId}/events",
      }),
    status: z
      .enum(["ready", "preparing", "generating"])
      .meta({
        description:
          "`ready`: start the mock now with `acceptFewer`: the bank holds its questions, or the plan's fair use for new questions is used for now, so it asks what the bank has (see `startAnytimeMock`). `preparing`: the goal's skill map is still being drawn; ask again in a few seconds. `generating`: follow the run's stream until `mockQuestionsReady`, then start the mock with `acceptFewer`",
      }),
  })
  .meta({ id: "MockQuestionsGeneration" });

export const mockPlanOfferResultSchema = z
  .object({
    changeId: z
      .uuid()
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
