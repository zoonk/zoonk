import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import { EXAM_DAY_CHECKLIST_KEYS, EXAM_STAGES } from "@zoonk/core/exams/final-stretch/rules";
import {
  MOCK_SCORINGS,
  mockChoiceSchema,
  mockResultSchema,
  netCalibrationSchema,
} from "@zoonk/core/exams/mocks/contract";
import { examResultScaleSchema } from "@zoonk/core/exams/results/contract";
import { EXAM_SCALES } from "@zoonk/core/exams/scales";
import {
  DAY_BEFORE_PLANS,
  type ExamMomentView,
  type ExamView,
} from "@zoonk/core/exams/view/contract";
import { speakingMockExamSchema } from "@zoonk/core/language/conversations/contract";
import { TOPIC_FREQUENCY_LEVELS } from "@zoonk/core/library/exams/blueprint-contract";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { MistakeCause } from "@zoonk/db";
import { z } from "zod";
import { estimatedScoreSchema } from "./preparation";
import { itemCitationSchema, logicalDateSchema } from "./study-sessions";

const clockTimeSchema = z.string().meta({ description: 'Local clock time, "HH:MM"' });

const examDaySchema = z
  .object({
    date: logicalDateSchema,
    label: z.string().nullable(),
    startTime: clockTimeSchema.nullable(),
  })
  .meta({ id: "ExamDay" });

const examDayChecklistSchema = z
  .array(z.enum(EXAM_DAY_CHECKLIST_KEYS))
  .meta({
    description:
      "Rehearsing the real exam day: keys ticked off on the device (a class test gets materials and sleep)",
  });

const dayBeforeSchema = z
  .enum(DAY_BEFORE_PLANS)
  .meta({
    description:
      "What the day before the test holds: light (a short review), mock (a class test's short mock), learn or learnAndMock (a test tomorrow: the topics that come up most, with or without the mock)",
  });

export const examMomentSchema = z
  .object({
    checklist: examDayChecklistSchema,
    day: examDaySchema.nullable(),
    dayBefore: dayBeforeSchema,
    examName: z.string(),
    mocksTaken: z.number().int().min(0),
    resultReported: z.boolean(),
    sessionsDone: z.number().int().min(0),
    stage: z.enum(EXAM_STAGES).exclude(["preparing"]),
    timeZone: z.string().nullable(),
  })
  .meta({ id: "ExamMoment" }) satisfies z.ZodType<ExamMomentView>;

const examMapLevelSchema = z.object({
  mastered: z.number().int().min(0),
  solid: z.number().int().min(0),
  studied: z.number().int().min(0),
  total: z.number().int().min(0),
});

const examMapTopicSchema = z.object({
  appearances: z.number().int().min(0).nullable(),
  frequency: z.enum(TOPIC_FREQUENCY_LEVELS).nullable(),
  name: z.string(),
});

const examMapSubjectSchema = z.object({
  frequency: z.enum(TOPIC_FREQUENCY_LEVELS).nullable(),
  level: examMapLevelSchema.nullable(),
  name: z.string(),
  questions: z.number().int().nullable(),
  share: z.number().min(0).max(1).nullable(),
  topics: z.array(examMapTopicSchema),
});

const examMapSchema = z
  .object({
    hasFrequency: z.boolean(),
    subjects: z.array(examMapSubjectSchema),
    topicCount: z.number().int().min(0),
  })
  .meta({ id: "ExamMap" });

export const examResultResponseSchema = z
  .object({
    maxScore: z.number().nullable(),
    passed: z.boolean().nullable(),
    reportedAt: z.iso.datetime(),
    scale: examResultScaleSchema.nullable(),
    score: z.number().nullable(),
  })
  .meta({ id: "ExamResult" });

export const examViewResponseSchema = z
  .object({
    calibration: netCalibrationSchema.nullable(),
    checklist: examDayChecklistSchema,
    dayBefore: dayBeforeSchema,
    days: z.array(examDaySchema),
    daysEstimated: z
      .boolean()
      .meta({
        description:
          "The days are the ones the exam usually falls on, estimated until the notice for the learner's year is out",
      }),
    daysLeft: z.number().int().nullable(),
    estimate: estimatedScoreSchema.nullable(),
    examName: z.string(),
    goalId: z.uuid(),
    map: examMapSchema.nullable(),
    mocks: z.array(
      z.object({
        blockId: z.uuid().nullable(),
        correct: z.number().int().min(0),
        finishedAt: z.iso.datetime(),
        measure: z
          .number()
          .meta({ description: "The IRT score, the net score or the percent right, by scoring" }),
        number: z.number().int().min(1),
        scoring: z.enum(MOCK_SCORINGS),
        total: z.number().int().min(0),
      }),
    ),
    result: examResultResponseSchema.nullable(),
    scoring: z.object({
      method: z.enum(MOCK_SCORINGS),
      note: z.string().nullable(),
      scale: z
        .enum(EXAM_SCALES)
        .nullable()
        .meta({ description: "The exam's own scale, which estimates and results use" }),
    }),
    sessionsDone: z.number().int().min(0),
    speakingMock: speakingMockExamSchema
      .nullable()
      .meta({
        description:
          "IELTS and TOEFL iBT goals: the exam whose speaking test runs as a live call (POST /v1/language-conversations with kind speakingMock); null for other exams",
      }),
    stage: z.enum(EXAM_STAGES),
    timeZone: z.string().nullable(),
  })
  .meta({ id: "ExamView" }) satisfies z.ZodType<ExamView>;

const mockQuestionSchema = z.object({
  area: z.string().nullable(),
  context: z.string().nullable(),
  format: z.enum(["multipleChoice", "trueFalse"]),
  itemId: z.uuid(),
  number: z.number().int().min(1),
  options: z.array(z.string()).nullable(),
  question: z.string(),
  skillId: z.uuid(),
});

export const mockViewResponseSchema = z
  .object({
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
    sessionId: z.uuid(),
    startTime: clockTimeSchema.nullable(),
    status: z.enum(["ready", "running", "finished"]),
    timeZone: z.string().nullable(),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "MockExam" });

export const mockStepResponseSchema = z
  .object({ status: z.enum(["next", "finished"]) })
  .meta({ id: "MockStep" });
