import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import { examDocumentSchema } from "@zoonk/core/exams/document";
import { essayGradeSchema } from "@zoonk/core/exams/essays/contract";
import { mockAnswerSchema } from "@zoonk/core/exams/mocks/answer-contract";
import {
  MOCK_PURPOSES,
  MOCK_SCORINGS,
  mockResultSchema,
  mockShapeSchema,
} from "@zoonk/core/exams/mocks/contract";
import { speakingSectionViewSchema } from "@zoonk/core/language/exam-speaking/contract";
import { passMarksSchema } from "@zoonk/core/library/exams/pass-marks";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { MistakeCause } from "@zoonk/db";
import { z } from "zod";
import {
  itemCitationSchema,
  questionEntrySchema,
  questionImageSchema,
  questionSelectSchema,
  questionUnitSchema,
  questionVisualSchema,
} from "./common";
import { clockTimeSchema } from "./exams";
import { itemSetSchema } from "./item-set";
import { mockLeftOutSchema } from "./mock-left-out";
import { mockScoreNotesSchema, mockSectionSchema, mockSizeSourceSchema } from "./mock-parts";
import { logicalDateSchema } from "./study-sessions";

/** The formats a mock asks in, the exam's own. */
const MOCK_QUESTION_FORMATS = ["multipleChoice", "numeric", "trueFalse", "typed"] as const;

const mockQuestionSchema = z.object({
  area: z.string().nullable(),
  context: z.string().nullable(),
  entry: questionEntrySchema
    .nullable()
    .meta({ description: "For `numeric`: how the answer box takes the number" }),
  format: z
    .enum([...MOCK_QUESTION_FORMATS, "essay"])
    .meta({
      description:
        "How it's answered: a pick (`multipleChoice`, by `select`; `trueFalse`), a number typed into the answer box (`numeric`, `{ number }`, beside `unit`), a word or a short answer typed in (`typed`, `{ text }`), or a full mock's written part (`essay`: an essay, a discursive test), its text (`{ text }`) on the section's clock",
    }),
  image: questionImageSchema,
  itemId: z.uuid(),
  number: z.number().int().min(1),
  options: z.array(z.string()).nullable(),
  question: z.string(),
  select: questionSelectSchema.nullable(),
  set: itemSetSchema
    .nullable()
    .meta({
      description:
        "The text, case or chart it shares with its set's other questions, asked together in the set's order: show it with each of them",
    }),
  skillId: z.uuid(),
  unit: questionUnitSchema,
  visual: questionVisualSchema,
});

const mockEssaySchema = z
  .object({
    area: z.string().nullable(),
    context: z.string().nullable(),
    grade: essayGradeSchema.nullable(),
    itemId: z.uuid(),
    question: z.string(),
    status: z
      .enum(["blank", "graded", "pending"])
      .meta({
        description:
          "`pending`: written and not graded yet: POST /v1/mocks/{blockId}/essay-grades right after hand-in, while the objective result already shows. `blank`: left blank",
      }),
    text: z.string().nullable(),
  })
  .meta({ id: "MockEssay" });

export const mockPurposeSchema = z
  .enum(MOCK_PURPOSES)
  .meta({
    description:
      "`planned`: the plan's weekly mock. `practice`: one taken any time. `placement`: a diagnostic mock taken in onboarding instead of the quick placement",
  });

const mockAdaptSchema = z
  .object({
    focus: z
      .object({ area: z.string(), correct: z.number(), total: z.number().int() })
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
    breakUntil: z.iso
      .datetime()
      .nullable()
      .meta({
        description:
          "On the break the notice gives between two sections: when the next one's clock starts on its own. `current` is null meanwhile; POST /v1/mocks/{blockId}/break-ends starts it earlier",
      }),
    canMove: z.boolean().meta({ description: '"Move to Monday" is possible before it starts' }),
    checklist: z.array(z.enum(EXAM_DAY_CHECKLIST)),
    current: z
      .object({
        changesLeft: z
          .number()
          .int()
          .min(0)
          .nullable()
          .meta({
            description:
              "In a forward-only section with a review at its end (`navigation.answerChanges`): the answers the review may still change; null without a limit",
          }),
        deadline: z.iso.datetime(),
        drafts: z.array(
          z.object({
            answer: mockAnswerSchema.nullable(),
            durationMs: z.number().int(),
            flagged: z.boolean(),
            itemId: z.uuid(),
          }),
        ),
        kind: z
          .enum(["listening", "speaking"])
          .nullable()
          .meta({
            description:
              "`listening`: its questions are on recordings (each question's `set.listening`, played as many times as the exam does); `speaking`: the speaking paper, with no questions (see `speaking`); null for the others",
          }),
        plays: z
          .array(z.object({ played: z.number().int().min(0), setId: z.uuid() }))
          .meta({
            description:
              "A listening section's recordings with the plays already counted (POST /v1/mocks/{blockId}/plays as each play starts), so another tab or device has the same plays left; empty for other sections",
          }),
        questions: z.array(mockQuestionSchema),
        resume: z
          .number()
          .int()
          .min(0)
          .meta({
            description:
              "The question to open at: in a forward-only section, the furthest one reached (the ones before it are behind the learner); 0 otherwise",
          }),
        section: z.number().int().min(0),
      })
      .nullable()
      .meta({ description: "The running section, never with answers" }),
    date: logicalDateSchema,
    day: z
      .number()
      .int()
      .nullable()
      .meta({ description: "Which exam day it copies, when the exam runs over several days" }),
    essayRubric: z
      .enum(["ap", "custom", "enem", "oab"])
      .nullable()
      .meta({ description: "The rubric its essays are graded by; null when it asks none" }),
    essays: z
      .array(mockEssaySchema)
      .meta({
        description: "A finished full mock's essays, each with its grade or why there's none",
      }),
    examDocument: examDocumentSchema,
    examName: z.string().nullable(),
    examQuestions: z
      .number()
      .int()
      .min(0)
      .nullable()
      .meta({
        description:
          "The exam's questions for what a mock taken any time sits, when it asks fewer (the bank had too few new ones, and a full mock never repeats answered ones): say how many of them it asks. Null when it asks them all",
      }),
    fullLength: z.boolean(),
    goalId: z.uuid().nullable(),
    leftOut: mockLeftOutSchema,
    minutes: z.number().int(),
    mistakes: z.array(
      z.object({ cause: z.enum(MistakeCause).nullable(), count: z.number().int() }),
    ),
    number: z.number().int().min(1),
    passMarks: passMarksSchema
      .nullable()
      .meta({
        description:
          "What it takes to pass, in the notice's own words, for a mock of the whole exam: show it beside the score, saying its language when it isn't the learner's; null otherwise",
      }),
    planItemId: z
      .uuid()
      .nullable()
      .meta({ description: "The plan item it plays: its challenge, before and on its day" }),
    purpose: mockPurposeSchema,
    questions: z.number().int(),
    result: mockResultSchema.nullable(),
    reusedQuestions: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "Questions it asks that the learner answered before, because the bank had no new ones left for them (the missed ones first, then the ones answered longest ago): say so on the mock's screen when above 0",
      }),
    review: z.array(
      z.object({
        area: z.string().nullable(),
        citation: itemCitationSchema,
        context: z
          .string()
          .nullable()
          .meta({ description: "The text the question reads before it, as the mock showed it" }),
        correctAnswer: z.string().nullable(),
        explanation: z.string().nullable(),
        format: z.enum(MOCK_QUESTION_FORMATS),
        itemId: z.uuid(),
        learnerAnswer: z.string().nullable(),
        number: z.number().int(),
        outcome: z
          .enum(["blank", "partial", "wrong"])
          .meta({
            description:
              "`partial`: a question with several picks that earned part of its points, where the notice gives partial credit",
          }),
        question: z.string(),
        set: itemSetSchema.nullable(),
      }),
    ),
    scoreNotes: mockScoreNotesSchema,
    scoring: z.enum(MOCK_SCORINGS),
    scoringNote: z.string().nullable(),
    sections: z.array(mockSectionSchema),
    sessionId: z
      .uuid()
      .nullable()
      .meta({ description: "The study session it was played in; null for a mock taken any time" }),
    shape: mockShapeSchema
      .nullable()
      .meta({ description: "What a mock taken any time sits; null for the plan's own" }),
    sizeSource: mockSizeSourceSchema,
    speaking: speakingSectionViewSchema
      .nullable()
      .meta({
        description:
          "Its speaking paper once the learner started its speaking section (POST /v1/mocks/{blockId}/speaking): each task a live call to open, and the paper's estimate once every task is graded, never an official score; null before and without one",
      }),
    startTime: clockTimeSchema.nullable(),
    status: z.enum(["ready", "running", "finished"]),
    timeZone: z.string().nullable(),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "MockExam" });

export const mockEssayGradesResponseSchema = z
  .object({ status: z.enum(["graded"]) })
  .meta({ id: "MockEssayGrades" });

export const mockStepResponseSchema = z
  .object({ status: z.enum(["next", "finished"]) })
  .meta({ id: "MockStep" });
