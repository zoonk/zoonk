import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type MistakeCause } from "@zoonk/db";
import { z } from "zod";
import { type ExamDayChecklistItem } from "../../checkpoints/weekly-challenge-rules";
import { answerTimeZoneSchema } from "../../learner/contract";
import { type TrueFalseLabels } from "../../library/exams/true-false-labels";
import { type ItemImage } from "../../library/items/item-image";
import { type ItemCitation } from "../../library/sources/source-citation";

/**
 * How a mock is scored, from the blueprint: item response theory (ENEM), wrong-cancels-right
 * (Cebraspe) or plain right answers.
 */
export const MOCK_SCORINGS = ["irt", "net", "raw"] as const;

export type MockScoring = (typeof MOCK_SCORINGS)[number];

/**
 * Why a mock is taken: the plan's weekly mock (`planned`, played from its session block), one the
 * learner takes whenever they want (`practice`), or one taken in onboarding instead of the quick
 * placement, whose answers set where the plan starts (`placement`).
 */
export const MOCK_PURPOSES = ["planned", "practice", "placement"] as const;

export type MockPurpose = (typeof MOCK_PURPOSES)[number];

/**
 * How much of the exam a mock taken any time sits: a whole exam day (`full`), half of one
 * (`half`), or one of the notice's subjects at the exam's pace (`area`).
 */
const MOCK_SHAPE_KINDS = ["full", "half", "area"] as const;

/** A subject's name is a line of the notice, never a paragraph. */
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
  itemIds: z.array(z.string()),
  minutes: z.int().min(1),
  name: z.string().nullable(),
  questions: z.int().min(0),
  routing: routingSchema.nullable(),
});

/**
 * What a mock sitting fixes when it starts (stored on `MockExam.conditions`): each section's
 * questions and minutes in the exam's order, the scoring, and when the real exam starts.
 */
export const mockConditionsSchema = z.object({
  day: z.int().nullable(),
  fullLength: z.boolean(),
  purpose: z.enum(MOCK_PURPOSES).default("planned"),
  scoring: z.enum(MOCK_SCORINGS),
  sections: z.array(mockSectionSchema),
  /** What a mock taken any time sits; null for the plan's own and a placement one. */
  shape: mockShapeSchema.nullable().default(null),
  startTime: z.string().nullable(),
  timeZone: z.string().nullable(),
  /** Sections that ended because their time ran out, not because the learner submitted them. */
  timedOutSections: z.array(z.int()).default([]),
});

export type MockConditions = z.infer<typeof mockConditionsSchema>;

/** A pick in a mock: an option or true/false. Null leaves the question blank. */
export const mockChoiceSchema = z
  .union([
    z.object({ selectedIndex: z.int().min(0) }).strict(),
    z.object({ isTrue: z.boolean() }).strict(),
  ])
  .meta({ id: "MockChoice" });

export type MockChoice = z.infer<typeof mockChoiceSchema>;

/** A stored draft's pick; anything else reads as blank. */
export function readMockChoice(value: unknown): MockChoice | null {
  return mockChoiceSchema.safeParse(value).data ?? null;
}

/** An hour covers the slowest question; anything longer is a tab left open. */
const MAX_ANSWER_DURATION_MS = 3_600_000;

export const mockAnswerInputSchema = z
  .object({
    answer: mockChoiceSchema.nullable().meta({ description: "Null leaves the question blank" }),
    durationMs: z
      .int()
      .min(0)
      .max(MAX_ANSWER_DURATION_MS)
      .meta({ description: "Total time spent on the question so far" }),
    flagged: z.boolean().meta({ description: "Marked to come back to; also means unsure" }),
    itemId: z.uuid(),
  })
  .strict()
  .meta({ id: "MockAnswerInput" });

export type MockAnswerInput = z.infer<typeof mockAnswerInputSchema>;

export const mockTimeZoneInputSchema = z
  .object({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "MockTimeZoneInput" });

export type MockTimeZoneInput = z.infer<typeof mockTimeZoneInputSchema>;

const areaResultSchema = z.object({
  correct: z.int(),
  name: z.string(),
  /** An area's estimated score on the exam's scale; only for item response theory. */
  score: z.object({ high: z.number(), low: z.number(), score: z.number() }).nullable(),
  secondsPerQuestion: z.number(),
  targetSecondsPerQuestion: z.number().nullable(),
  total: z.int(),
});

/** One of the mock's topics (the skill its questions ask), so the result can say how each went. */
const topicResultSchema = z.object({
  area: z.string().nullable(),
  correct: z.int(),
  name: z.string(),
  skillId: z.string(),
  total: z.int(),
});

const calibrationGroupSchema = z.object({ answered: z.int().min(0), right: z.int().min(0) });

/** Cebraspe exams: how often the learner is right when sure and when unsure. */
export const netCalibrationSchema = z
  .object({
    advice: z.enum(["blankUnsure", "keepAnswering"]).nullable(),
    blankingGain: z
      .int()
      .meta({ description: "Net points leaving unsure answers blank would have gained" }),
    sure: calibrationGroupSchema,
    unsure: calibrationGroupSchema.meta({ description: "Answers the learner flagged" }),
  })
  .meta({ id: "NetCalibration" });

/**
 * What a finished mock showed, kept as numbers and names so it survives content changes: the
 * score in the exam's own terms (estimated where it's an estimate), time per question against the
 * exam's pace, and the patterns that cost points.
 */
export const mockResultSchema = z
  .object({
    areas: z.array(areaResultSchema),
    blank: z.int(),
    calibration: netCalibrationSchema.nullable(),
    coherence: z
      .object({ easyWrong: z.int(), hardRight: z.int(), isCoherent: z.boolean() })
      .nullable(),
    correct: z.int(),
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
      .object({ blank: z.int(), max: z.int(), net: z.int(), right: z.int(), wrong: z.int() })
      .nullable(),
    plannedMinutes: z.number(),
    preparation: z.object({ after: z.number(), before: z.number() }).nullable(),
    /** The same measure on the goal's previous mock, for "+16 since the last one". */
    previous: z.number().nullable(),
    scoring: z.enum(MOCK_SCORINGS),
    /** Each topic it asked, in the order it first came up; empty for mocks graded before topics. */
    topics: z.array(topicResultSchema).default([]),
    total: z.int(),
    /** Questions still unanswered when a section's time ran out. */
    unansweredAtTimeout: z.int(),
  })
  .meta({ id: "MockResult" });

export type MockResult = z.infer<typeof mockResultSchema>;

/** A question as the learner sees it during the mock: never the answer or why. */
export type MockQuestion = {
  area: string | null;
  context: string | null;
  format: "multipleChoice" | "trueFalse";
  /** The figure the question is about, when it's about one. */
  image: ItemImage | null;
  itemId: string;
  /** Its number across the whole mock, as the answer sheet counts. */
  number: number;
  options: string[] | null;
  question: string;
  skillId: string;
  /** A chart or timeline the question reads, drawn from its data. */
  visual: LessonVisual | null;
};

export type MockDraft = {
  answer: MockChoice | null;
  durationMs: number;
  flagged: boolean;
  itemId: string;
};

export type MockSectionView = {
  index: number;
  minutes: number;
  name: string | null;
  questions: number;
  status: "current" | "done" | "upcoming";
};

/** A question missed or left blank, with the right answer and why, once the mock is over. */
export type MockReviewEntry = {
  area: string | null;
  /**
   * The passage it quotes, such as an article of law, with its source's title, link and the date
   * it was last checked.
   */
  citation: ItemCitation | null;
  /** For true or false questions, the answers are "true" or "false", shown in the app's words. */
  correctAnswer: string | null;
  explanation: string | null;
  format: "multipleChoice" | "trueFalse";
  itemId: string;
  learnerAnswer: string | null;
  number: number;
  outcome: "blank" | "wrong";
  question: string;
};

/**
 * The mock screen (the weekly mock exam, the Big Challenge, or a mock taken any time): before it
 * starts, the exam's conditions and the day's checklist; while it runs, the current section's
 * questions, its deadline and the learner's drafts; once it's over, what it showed, the mistakes
 * by cause and the questions to review.
 */
export type MockView = {
  /** What it offers to change in the plan once it's over; null before, and for a placement one. */
  adapt: MockAdaptView | null;
  /** The id it opens by: its session block's, or its own for a mock taken any time. */
  blockId: string;
  brainPower: number;
  canMove: boolean;
  checklist: ExamDayChecklistItem[];
  current: {
    deadline: string;
    drafts: MockDraft[];
    questions: MockQuestion[];
    section: number;
  } | null;
  /** The session's day, YYYY-MM-DD. */
  date: string;
  examName: string | null;
  fullLength: boolean;
  goalId: string | null;
  minutes: number;
  mistakes: { cause: MistakeCause | null; count: number }[];
  /** "Mock exam 3": this goal's mocks, counting this one. */
  number: number;
  /** The plan item it plays, whose intro is the challenge page; null for an unplanned one. */
  planItemId: string | null;
  purpose: MockPurpose;
  questions: number;
  result: MockResult | null;
  review: MockReviewEntry[];
  scoring: MockScoring;
  /** The exam's own words on scoring, such as "A wrong answer cancels a right one." */
  scoringNote: string | null;
  sections: MockSectionView[];
  /** The study session it was played in; null for a mock taken any time. */
  sessionId: string | null;
  /** What a mock taken any time sits (a whole day, half of one, a subject); null for the plan's. */
  shape: MockShape | null;
  /** When the real exam starts, in its own time zone, so the mock can match it. */
  startTime: string | null;
  status: "finished" | "ready" | "running";
  timeZone: string | null;
  /** The words the exam's true-or-false statements are answered with. */
  trueFalseLabels: TrueFalseLabels;
};

/**
 * How long a mock taken as placement runs, as the learner picks it: a quick check (about a quarter
 * of an hour), about half an hour, or about an hour. A longer one sets a finer starting point.
 */
export const PLACEMENT_MOCK_LENGTHS = ["short", "medium", "long"] as const;

export type PlacementMockLength = (typeof PLACEMENT_MOCK_LENGTHS)[number];

/** Which mock taken any time: one of the goal's options, or a diagnostic one as placement. */
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

/** Writing the questions a mock taken any time still needs, before it starts. */
export const mockQuestionsInputSchema = anytimeMockChoiceSchema
  .strict()
  .meta({ id: "MockQuestionsInput" });

/**
 * Taking a mock any time. `acceptFewer` starts it with the questions there are when the bank holds
 * fewer than the option asks, once a run wrote what it could; without it, a short bank answers
 * `needsQuestions`.
 */
export const anytimeMockInputSchema = anytimeMockChoiceSchema
  .extend({
    acceptFewer: z
      .boolean()
      .optional()
      .meta({
        description:
          "Start with the questions there are when the bank holds fewer than the option asks; send it after a question-writing run finished",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "AnytimeMockInput" });

export type AnytimeMockInput = z.infer<typeof anytimeMockInputSchema>;

/** A mock the learner can take any time, with its honest size (see `MockOption`). */
export type MockOptionView = MockShape & {
  /** The notice's subjects it asks, in its words. */
  areas: string[];
  /**
   * About how long it takes: learners' real pace on this exam's mocks, or the exam's own pace
   * until there's enough of it; never more than `minutes`.
   */
  estimatedMinutes: number;
  /** The exam's time for it, which its clock gives. */
  minutes: number;
  /** The exam day also has a written part (a redação, a discursive test) this mock leaves out. */
  objectiveOnly: boolean;
  questions: number;
};

/**
 * A diagnostic mock taken as placement, in one of its lengths: its questions spread over each
 * subject's topics, in the exam's format and order, at the exam's pace.
 */
export type PlacementMockOptionView = {
  /** The notice's subjects it asks, in its words: every one, or the ones worth most. */
  areas: string[];
  /** It asks every subject the plan has; a short one may leave the smallest to the first days. */
  coversAllAreas: boolean;
  /** About how long it takes (see `MockOptionView.estimatedMinutes`). */
  estimatedMinutes: number;
  length: PlacementMockLength;
  /** The exam's time for it, which its clock gives. */
  minutes: number;
  questions: number;
};

/**
 * The mocks an exam goal's learner can take whenever they want, beside the plan's weekly ones:
 * each exam day, half of one, each subject, with their questions and time. Every mock exam comes
 * with Plus: `plusRequired` when the learner's plan doesn't include them, and the options stay
 * visible. `running`: the one they started and haven't finished, which they continue before
 * starting another.
 */
export type MockOptionsView = {
  access: "open" | "plusRequired";
  examName: string;
  goalId: string;
  options: MockOptionView[];
  /**
   * A diagnostic mock in onboarding instead of the quick placement (POST with `purpose:
   * placement` and a `length`), in the lengths it comes in with the one to suggest, and the goal's
   * own once started. Null when the exam has no questions to ask.
   */
  placement: {
    mock: { id: string; status: "finished" | "running" } | null;
    options: PlacementMockOptionView[];
    recommended: PlacementMockLength;
  } | null;
  running: { id: string; purpose: MockPurpose; shape: MockShape | null } | null;
};

/**
 * What a finished mock offers to change in the plan, each answered by the learner, never applied
 * on its own: skip the lessons of the topics it showed they know (every question on them right),
 * and give the area that went worst more of the plan's time. Null parts have nothing to offer.
 */
export type MockAdaptView = {
  focus: { area: string; correct: number; total: number } | null;
  skip: { lessons: number; topics: string[] } | null;
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
