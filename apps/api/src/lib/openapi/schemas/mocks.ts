import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import {
  MOCK_PURPOSES,
  MOCK_SCORINGS,
  type MockOptionView,
  type MockOptionsView,
  PLACEMENT_MOCK_LENGTHS,
  type PlacementMockOptionView,
  mockChoiceSchema,
  mockResultSchema,
  mockShapeSchema,
} from "@zoonk/core/exams/mocks/contract";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { MistakeCause } from "@zoonk/db";
import { z } from "zod";
import { itemCitationSchema, questionImageSchema, questionVisualSchema } from "./common";
import { clockTimeSchema } from "./exams";
import { logicalDateSchema } from "./study-sessions";

const mockQuestionSchema = z.object({
  area: z.string().nullable(),
  context: z.string().nullable(),
  format: z.enum(["multipleChoice", "trueFalse"]),
  image: questionImageSchema,
  itemId: z.uuid(),
  number: z.number().int().min(1),
  options: z.array(z.string()).nullable(),
  question: z.string(),
  skillId: z.uuid(),
  visual: questionVisualSchema,
});

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
    estimatedMinutes: estimatedMinutesSchema,
    minutes: z
      .number()
      .int()
      .min(1)
      .meta({ description: "The exam's time for it, which its clock gives" }),
    objectiveOnly: z
      .boolean()
      .meta({
        description:
          "The exam day also has a written part (a redação, a discursive test) this mock leaves out",
      }),
    questions: z.number().int().min(0),
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

const mockPurposeSchema = z
  .enum(MOCK_PURPOSES)
  .meta({
    description:
      "`planned`: the plan's weekly mock. `practice`: one taken any time. `placement`: a diagnostic mock taken in onboarding instead of the quick placement",
  });

export const mockOptionsResponseSchema = z
  .object({
    access: z
      .enum(["open", "plusRequired"])
      .meta({
        description:
          "`plusRequired`: every mock exam comes with Plus (the placement one included); show the options with what it takes",
      }),
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
  })
  .meta({ id: "MockOptions" }) satisfies z.ZodType<MockOptionsView>;

export const anytimeMockResponseSchema = z
  .object({
    id: z
      .uuid()
      .nullable()
      .meta({ description: "The mock's id (GET /v1/mocks/{id}); null for needsQuestions" }),
    status: z
      .enum(["started", "running", "needsQuestions"])
      .meta({
        description:
          "`started`: the mock runs, its first section's clock going. `running`: one was running already; continue it. `needsQuestions`: the shared bank is short of the mock's questions: POST /goals/{goalId}/mocks/generations, follow the run, then start again (with `acceptFewer` after the run)",
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
          "`ready`: start the mock now. `preparing`: the goal's skill map is still being drawn; ask again in a few seconds. `generating`: follow the run's stream until `mockQuestionsReady`, then start the mock with `acceptFewer`",
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

const mockAdaptSchema = z
  .object({
    focus: z
      .object({ area: z.string(), correct: z.number().int(), total: z.number().int() })
      .nullable()
      .meta({ description: "The area that went worst, to give more of the plan's time" }),
    skip: z
      .object({ lessons: z.number().int().min(1), topics: z.array(z.string()) })
      .nullable()
      .meta({
        description:
          "The lessons of the topics the mock showed the learner knows (every question right), to skip",
      }),
  })
  .nullable()
  .meta({
    description:
      "What the finished mock offers to change in the plan, each applied only once the learner says so (POST /v1/mocks/{blockId}/plan-changes); null before it's over and for a placement mock",
    id: "MockAdapt",
  });

export const mockViewResponseSchema = z
  .object({
    adapt: mockAdaptSchema,
    blockId: z.uuid(),
    brainPower: z.number().int(),
    canMove: z.boolean().meta({ description: '"Move to Monday" is possible before it starts' }),
    checklist: z.array(z.enum(EXAM_DAY_CHECKLIST)),
    current: z
      .object({
        deadline: z.iso.datetime(),
        drafts: z.array(
          z.object({
            answer: mockChoiceSchema.nullable(),
            durationMs: z.number().int(),
            flagged: z.boolean(),
            itemId: z.uuid(),
          }),
        ),
        questions: z.array(mockQuestionSchema),
        section: z.number().int().min(0),
      })
      .nullable()
      .meta({ description: "The running section, never with answers" }),
    date: logicalDateSchema,
    examName: z.string().nullable(),
    fullLength: z.boolean(),
    goalId: z.uuid().nullable(),
    minutes: z.number().int(),
    mistakes: z.array(
      z.object({ cause: z.enum(MistakeCause).nullable(), count: z.number().int() }),
    ),
    number: z.number().int().min(1),
    planItemId: z
      .uuid()
      .nullable()
      .meta({ description: "The plan item it plays: its challenge, before and on its day" }),
    purpose: mockPurposeSchema,
    questions: z.number().int(),
    result: mockResultSchema.nullable(),
    review: z.array(
      z.object({
        area: z.string().nullable(),
        citation: itemCitationSchema,
        correctAnswer: z.string().nullable(),
        explanation: z.string().nullable(),
        format: z.enum(["multipleChoice", "trueFalse"]),
        itemId: z.uuid(),
        learnerAnswer: z.string().nullable(),
        number: z.number().int(),
        outcome: z.enum(["blank", "wrong"]),
        question: z.string(),
      }),
    ),
    scoring: z.enum(MOCK_SCORINGS),
    scoringNote: z.string().nullable(),
    sections: z.array(
      z.object({
        index: z.number().int(),
        minutes: z.number().int(),
        name: z.string().nullable(),
        questions: z.number().int(),
        status: z.enum(["current", "done", "upcoming"]),
      }),
    ),
    sessionId: z
      .uuid()
      .nullable()
      .meta({ description: "The study session it was played in; null for a mock taken any time" }),
    shape: mockShapeSchema
      .nullable()
      .meta({ description: "What a mock taken any time sits; null for the plan's own" }),
    startTime: clockTimeSchema.nullable(),
    status: z.enum(["ready", "running", "finished"]),
    timeZone: z.string().nullable(),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "MockExam" });

export const mockStepResponseSchema = z
  .object({ status: z.enum(["next", "finished"]) })
  .meta({ id: "MockStep" });
