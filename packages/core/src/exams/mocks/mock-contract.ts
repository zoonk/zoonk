import { PARTIAL_CREDIT_RULES } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { type MistakeCause } from "@zoonk/db";
import { z } from "zod";
import { type ExamDayChecklistItem } from "../../checkpoints/weekly-challenge-rules";
import { type SpeakingSectionView } from "../../language/exam-speaking/speaking-contract";
import { answerTimeZoneSchema } from "../../learner/contract";
import { sectionNavigationSchema } from "../../library/exams/blueprint-contract";
import { type PassMarks } from "../../library/exams/pass-marks";
import { type TrueFalseLabels } from "../../library/exams/true-false-labels";
import { type MilestoneView, type MissionMomentView } from "../../sessions/completion-contract";
import { type Reached } from "../../sessions/reached";
import { type EssayView } from "../essays/essay-contract";
import { type ExamDocument } from "../exam-document";
import { type ExamMockSummary } from "../view/exam-view-contract";
import {
  type MockAdaptView,
  type MockCurrentSection,
  type MockEssayView,
  type MockLeftOut,
  type MockReviewEntry,
  type MockScoreNotes,
  type MockSectionView,
  type MockSizeSource,
} from "./mock-view-contract";

const MS_PER_MINUTE = 60_000;

export const MOCK_ABANDONMENT_DELAY_MS = 10 * MS_PER_MINUTE;

export const MOCK_SCORINGS = ["irt", "net", "raw"] as const;

export type MockScoring = (typeof MOCK_SCORINGS)[number];

export const MOCK_PURPOSES = ["planned", "practice", "placement"] as const;

export type MockPurpose = (typeof MOCK_PURPOSES)[number];

const MOCK_SHAPE_KINDS = ["full", "half", "area"] as const;

const MAX_AREA_NAME = 200;

export const mockShapeSchema = z
  .object({
    area: z
      .string()
      .min(1)
      .max(MAX_AREA_NAME)
      .nullable()
      .meta({ description: "For `area`: the notice's subject, as the options name it" }),
    day: z
      .int()
      .min(1)
      .nullable()
      .meta({
        description: "For `full` and `half`: the exam day it copies, when there are several",
      }),
    kind: z.enum(MOCK_SHAPE_KINDS),
  })
  .strict()
  .meta({ id: "MockShape" });

export type MockShape = z.infer<typeof mockShapeSchema>;

const routingSchema = z.object({ easier: z.array(z.string()), harder: z.array(z.string()) });

const mockSectionSchema = z.object({
  breakAfterMinutes: z.int().min(1).nullable().optional(),
  essays: z.array(z.string()),
  itemIds: z.array(z.string()),
  kind: z.enum(["listening", "speaking"]).optional(),
  minutes: z.int().min(1),
  name: z.string().nullable(),
  navigation: sectionNavigationSchema.nullable().optional(),
  questions: z.int().min(0),
  routing: routingSchema.nullable(),
  speakingSectionId: z.uuid().nullable().optional(),
  tools: z.string().nullable().optional(),
});

export const mockConditionsSchema = z.object({
  day: z.int().nullable(),
  examQuestions: z.int().min(0).nullable(),
  fullLength: z.boolean(),
  partialCredit: z.enum(PARTIAL_CREDIT_RULES),
  purpose: z.enum(MOCK_PURPOSES),
  reused: z.int().min(0),
  scoring: z.enum(MOCK_SCORINGS),
  sections: z.array(mockSectionSchema),
  shape: mockShapeSchema.nullable(),
  startTime: z.string().nullable(),
  timeZone: z.string().nullable(),
  timedOutSections: z.array(z.int()),
  wrongPenalty: z.number().min(0).max(1),
});

export type MockConditions = z.infer<typeof mockConditionsSchema>;

export const mockTimeZoneInputSchema = z
  .object({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "MockTimeZoneInput" });

export type MockTimeZoneInput = z.infer<typeof mockTimeZoneInputSchema>;

const areaResultSchema = z.object({
  correct: z.number(),
  name: z.string(),
  score: z.object({ high: z.number(), low: z.number(), score: z.number() }).nullable(),
  secondsPerQuestion: z.number(),
  targetSecondsPerQuestion: z.number().nullable(),
  total: z.int(),
});

const topicResultSchema = z.object({
  area: z.string().nullable(),
  correct: z.int(),
  name: z.string(),
  skillId: z.string(),
  total: z.int(),
});

const calibrationGroupSchema = z.object({ answered: z.int().min(0), right: z.int().min(0) });

export const netCalibrationSchema = z
  .object({
    advice: z.enum(["blankUnsure", "keepAnswering"]).nullable(),
    blankingGain: z
      .number()
      .meta({ description: "Net points leaving unsure answers blank would have gained" }),
    sure: calibrationGroupSchema,
    unsure: calibrationGroupSchema.meta({ description: "Answers the learner flagged" }),
  })
  .meta({ id: "NetCalibration" });

export const mockResultSchema = z
  .object({
    areas: z.array(areaResultSchema),
    blank: z.int(),
    calibration: netCalibrationSchema.nullable(),
    coherence: z
      .object({ easyWrong: z.int(), hardRight: z.int(), isCoherent: z.boolean() })
      .nullable(),
    correct: z.number(),
    irt: z
      .object({
        high: z.number(),
        low: z.number(),
        score: z.number(),
        se: z.number(),
        theta: z.number(),
      })
      .nullable(),
    minutesUsed: z.number(),
    net: z
      .object({
        blank: z.int(),
        max: z.int(),
        net: z.number(),
        partial: z.int(),
        penalty: z.number(),
        right: z.int(),
        wrong: z.int(),
      })
      .nullable(),
    plannedMinutes: z.number(),
    preparation: z.object({ after: z.number(), before: z.number() }).nullable(),
    previous: z.number().nullable(),
    scoring: z.enum(MOCK_SCORINGS),
    topics: z.array(topicResultSchema),
    total: z.int(),
    unansweredAtTimeout: z.int(),
  })
  .meta({ id: "MockResult" });

export type MockResult = z.infer<typeof mockResultSchema>;

export type MockView = {
  adapt: MockAdaptView | null;
  blockId: string;
  brainPower: number;
  breakUntil: string | null;
  canMove: boolean;
  ceremony: MilestoneView | null;
  checklist: ExamDayChecklistItem[];
  current: MockCurrentSection | null;
  date: string;
  day: number | null;
  essayRubric: EssayView["rubric"] | null;
  leftOut: MockLeftOut[];
  essays: MockEssayView[];
  examDocument: ExamDocument;
  examName: string | null;
  examQuestions: number | null;
  fullLength: boolean;
  goalId: string | null;
  minutes: number;
  missionMoment: MissionMomentView | null;
  mistakes: { cause: MistakeCause | null; count: number }[];
  number: number;
  passMarks: PassMarks | null;
  planItemId: string | null;
  purpose: MockPurpose;
  questions: number;
  reached: Reached;
  result: MockResult | null;
  reusedQuestions: number;
  review: MockReviewEntry[];
  scoring: MockScoring;
  scoringNote: string | null;
  sections: MockSectionView[];
  sessionId: string | null;
  shape: MockShape | null;
  scoreNotes: MockScoreNotes;
  speaking: SpeakingSectionView | null;
  sizeSource: MockSizeSource;
  startTime: string | null;
  status: "expired" | "finished" | "ready" | "running";
  timeZone: string | null;
  trueFalseLabels: TrueFalseLabels;
};

export const PLACEMENT_MOCK_LENGTHS = ["short", "medium", "long"] as const;

export type PlacementMockLength = (typeof PLACEMENT_MOCK_LENGTHS)[number];

const anytimeMockChoiceSchema = z.object({
  length: z
    .enum(PLACEMENT_MOCK_LENGTHS)
    .optional()
    .meta({
      description:
        "For `placement`: how long, as `placement.options` lists them; the recommended one when left out",
    }),
  purpose: z
    .enum(["practice", "placement"])
    .optional()
    .meta({
      description:
        "`practice` (the default): one of the goal's options, by `shape`. `placement`: a diagnostic mock in the exam's format in onboarding, instead of the quick placement; its answers set where the plan starts",
    }),
  shape: mockShapeSchema
    .optional()
    .meta({ description: "For `practice`: the option picked from GET /v1/goals/{goalId}/mocks" }),
});

export type AnytimeMockChoice = z.infer<typeof anytimeMockChoiceSchema>;

export const mockQuestionsInputSchema = anytimeMockChoiceSchema
  .strict()
  .meta({ id: "MockQuestionsInput" });

export const anytimeMockInputSchema = anytimeMockChoiceSchema
  .extend({
    acceptFewer: z
      .boolean()
      .optional()
      .meta({
        description:
          "Start with the questions there are when the bank holds fewer than the option asks; send it after a question-writing run finished",
      }),
  })
  .strict()
  .meta({ id: "AnytimeMockInput" });

export type AnytimeMockInput = z.infer<typeof anytimeMockInputSchema>;

export type MockOptionView = MockShape & {
  areas: string[];
  covers: string[] | null;
  estimatedMinutes: number;
  minutes: number;
  leftOut: MockLeftOut[];
  objectiveOnly: boolean;
  questions: number;
  written: string[];
};

export type PlacementMockOptionView = {
  areas: string[];
  coversAllAreas: boolean;
  estimatedMinutes: number;
  length: PlacementMockLength;
  minutes: number;
  questions: number;
};

export type MockOptionsView = {
  access: "open" | "plusRequired";
  examDocument: ExamDocument;
  examName: string;
  sizeSource: MockSizeSource;
  goalId: string;
  lastMock: ExamMockSummary | null;
  options: MockOptionView[];
  placement: {
    mock: { id: string; status: "finished" | "running" } | null;
    options: PlacementMockOptionView[];
    recommended: PlacementMockLength;
  } | null;
  running: { id: string; purpose: MockPurpose; shape: MockShape | null } | null;
};

const MOCK_PLAN_OFFERS = ["skip", "focus"] as const;

export const mockPlanOfferInputSchema = z
  .object({
    offer: z
      .enum(MOCK_PLAN_OFFERS)
      .meta({
        description:
          "`skip`: the plan skips the lessons of the topics the mock showed the learner knows (`adapt.skip`), with an undo. `focus`: the area that went worst gets more of the plan's time (`adapt.focus`)",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "MockPlanOfferInput" });

export type MockPlanOfferInput = z.infer<typeof mockPlanOfferInputSchema>;
