import { targetCutoffSchema } from "@zoonk/core/exams/cutoffs/contract";
import { EXAM_DAY_CHECKLIST_KEYS, EXAM_STAGES } from "@zoonk/core/exams/final-stretch/rules";
import {
  MOCK_PURPOSES,
  MOCK_SCORINGS,
  mockShapeSchema,
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
import { z } from "zod";
import { estimatedScoreSchema } from "./preparation";
import { logicalDateSchema } from "./study-sessions";

export const clockTimeSchema = z.string().meta({ description: 'Local clock time, "HH:MM"' });

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
      "What the day before the test holds: light (a short review), mock (a class test's short mock), review (a full review of every topic in the test's format, the weakest first, in place of a short mock the learner's plan doesn't include), learn or learnAndMock (a test tomorrow: the topics that come up most, with or without the mock)",
  });

const examFormatDaySchema = z
  .object({
    date: logicalDateSchema
      .nullable()
      .meta({ description: "From the exam's calendar; null when it doesn't have that day" }),
    day: z.number().int().min(1).meta({ description: "The notice's day, from 1" }),
    minutes: z
      .number()
      .int()
      .min(0)
      .nullable()
      .meta({ description: "The day's time; null when the notice doesn't give every part's" }),
    parts: z.array(
      z.object({
        name: z.string().meta({ description: "In the notice's words" }),
        questions: z.number().int().min(0).nullable(),
        written: z
          .boolean()
          .meta({ description: "Answered in writing (an essay): no questions to count" }),
      }),
    ),
  })
  .meta({ id: "ExamFormatDay" });

export const examMomentSchema = z
  .object({
    checklist: examDayChecklistSchema,
    day: examDaySchema.nullable(),
    dayBefore: dayBeforeSchema,
    examName: z.string(),
    mocksTaken: z.number().int().min(0),
    prepared: z
      .boolean()
      .meta({
        description:
          "The learner did what their plan asked before today (a session, no lessons left from earlier days, most study days finished): say they prepared only when true",
      }),
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
  group: z
    .string()
    .nullable()
    .meta({
      description:
        'The notice\'s group for the subject, such as "Conhecimentos básicos (P1)"; null when the notice has none',
    }),
  level: examMapLevelSchema.nullable(),
  name: z.string(),
  questions: z.number().int().nullable(),
  share: z.number().min(0).max(1).nullable(),
  topics: z.array(examMapTopicSchema),
});

const examMapSchema = z
  .object({
    hasFrequency: z.boolean(),
    questionsSource: z
      .object({ edition: z.string().nullable(), title: z.string().nullable(), url: z.string() })
      .nullable()
      .meta({
        description:
          "Where the subjects' question counts come from when the notice gives none: the exam's latest edition, as one source counted it",
      }),
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
    cutoff: targetCutoffSchema
      .nullable()
      .meta({
        description:
          "The last published cut-off of the learner's target (a course at an institution, a position) for the general list, with its source: show it as where the bar was, never as a promise. Null when none was found",
      }),
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
    format: z
      .array(examFormatDaySchema)
      .meta({
        description:
          "The exam day by day as its notice sets it out (each sitting's date, time and parts); empty when the notice doesn't state it",
      }),
    goalId: z.uuid(),
    map: examMapSchema.nullable(),
    mocks: z.array(
      z.object({
        blockId: z
          .uuid()
          .nullable()
          .meta({
            description:
              "The id its result opens by (GET /v1/mocks/{blockId}): its session block's for a mock the plan scheduled, its own for one taken any time",
          }),
        correct: z.number().int().min(0),
        finishedAt: z.iso.datetime(),
        measure: z
          .number()
          .meta({ description: "The IRT score, the net score or the percent right, by scoring" }),
        number: z.number().int().min(1),
        purpose: z
          .enum(MOCK_PURPOSES)
          .meta({ description: "The plan's weekly mock, one taken any time, or placement" }),
        scoring: z.enum(MOCK_SCORINGS),
        shape: mockShapeSchema
          .nullable()
          .meta({ description: "What a mock taken any time sat; null for the plan's" }),
        total: z.number().int().min(0),
      }),
    ),
    mocksRequirePlus: z
      .boolean()
      .meta({
        description:
          "Mock exams come with Plus and the learner's plan doesn't include them: show them (the next one too) locked, with a way to Plus, never hidden",
      }),
    nextMock: z
      .object({
        date: logicalDateSchema.nullable(),
        fullLength: z
          .boolean()
          .meta({ description: "The whole exam day; otherwise a short mock, half of it" }),
        planItemId: z
          .uuid()
          .meta({ description: "Its plan item, whose challenge introduces it before its day" }),
        questions: z.number().int().min(0),
      })
      .nullable()
      .meta({
        description:
          "The plan's next mock exam, also when the learner's plan doesn't include mocks (`mocksRequirePlus`); null when the next checkpoint isn't one",
      }),
    passMarks: z
      .array(z.string())
      .meta({ description: "What it takes to pass, as the notice says it; empty when it doesn't" }),
    prepared: z
      .boolean()
      .meta({
        description:
          "The learner did what their plan asked before today (a session, no lessons left from earlier days, most study days finished): say they prepared only when true",
      }),
    result: examResultResponseSchema.nullable(),
    scoring: z.object({
      method: z.enum(MOCK_SCORINGS),
      note: z.string().nullable(),
      scale: z
        .enum(EXAM_SCALES)
        .nullable()
        .meta({ description: "The exam's own scale, which estimates and results use" }),
      stated: z
        .boolean()
        .meta({
          description:
            "The notice says how the exam is scored. False when `method` is the mocks' default (a class test from the learner's material, a notice that doesn't say): don't give advice from it",
        }),
    }),
    sessionsDone: z.number().int().min(0),
    speakingMock: speakingMockExamSchema
      .nullable()
      .meta({
        description:
          "IELTS and TOEFL iBT goals: the exam whose speaking test runs as a live call (POST /v1/language-conversations with kind speakingMock); null for other exams",
      }),
    stage: z.enum(EXAM_STAGES),
    targetScore: z
      .string()
      .nullable()
      .meta({ description: "The score the learner said they aim for, in their words" }),
    timeZone: z.string().nullable(),
  })
  .meta({ id: "ExamView" }) satisfies z.ZodType<ExamView>;
