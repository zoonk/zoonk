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

/** A read may declare a mock abandoned this long after its section deadline, depending on its answers and purpose. */
export const MOCK_ABANDONMENT_DELAY_MS = 10 * MS_PER_MINUTE;

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
  /** The break after it, before the next section's clock starts. */
  breakAfterMinutes: z.int().min(1).nullable().optional(),
  /** The essays a full mock's written part asks on the section's clock. */
  essays: z.array(z.string()),
  itemIds: z.array(z.string()),
  /**
   * `listening`: its questions are on recordings it plays; `speaking`: the speaking paper, its
   * tasks live calls; absent for the others.
   */
  kind: z.enum(["listening", "speaking"]).optional(),
  minutes: z.int().min(1),
  name: z.string().nullable(),
  /** How candidates move through it, as the notice says; none moves freely. */
  navigation: sectionNavigationSchema.nullable().optional(),
  questions: z.int().min(0),
  routing: routingSchema.nullable(),
  /**
   * A speaking section's paper, once the learner reached it and its task cards were written
   * (`startMockSpeaking`): one per mock, kept so a reload never writes another.
   */
  speakingSectionId: z.uuid().nullable().optional(),
  /** What may be used or is given in it, in the notice's words. */
  tools: z.string().nullable().optional(),
});

/**
 * What a mock sitting fixes when it starts (stored on `MockExam.conditions`): each section's
 * questions and minutes in the exam's order, the scoring, and when the real exam starts.
 */
export const mockConditionsSchema = z.object({
  day: z.int().nullable(),
  /**
   * The questions of the exam (or of the part of it) a mock taken any time sits, when it asks
   * fewer: the bank had too few new ones, and a full mock never repeats answered ones to make up
   * for them. Null when it asks them all, and for the plan's own mocks.
   */
  examQuestions: z.int().min(0).nullable(),
  fullLength: z.boolean(),
  /**
   * How a question with several picks scores when partly right, as the notice says (see
   * `getPickCredit`); only every right option earns it when the notice does not say.
   */
  partialCredit: z.enum(PARTIAL_CREDIT_RULES),
  purpose: z.enum(MOCK_PURPOSES),
  /**
   * Questions it asks that the learner answered before, which a mock asks only once the bank has
   * no new ones left for them (the missed ones first).
   */
  reused: z.int().min(0),
  scoring: z.enum(MOCK_SCORINGS),
  sections: z.array(mockSectionSchema),
  /** What a mock taken any time sits; null for the plan's own and a placement one. */
  shape: mockShapeSchema.nullable(),
  startTime: z.string().nullable(),
  timeZone: z.string().nullable(),
  /** Sections that ended because their time ran out, not because the learner submitted them. */
  timedOutSections: z.array(z.int()),
  /** For `net`, the share of a right answer each wrong one takes away. */
  wrongPenalty: z.number().min(0).max(1),
});

export type MockConditions = z.infer<typeof mockConditionsSchema>;

export const mockTimeZoneInputSchema = z
  .object({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "MockTimeZoneInput" });

export type MockTimeZoneInput = z.infer<typeof mockTimeZoneInputSchema>;

/**
 * `correct` counts right answers, plus the share a multi-pick question answered partly right
 * earned where the notice gives partial credit (two decimals).
 */
const areaResultSchema = z.object({
  correct: z.number(),
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
      .number()
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
    /** Right answers, with partial credit's shares (see `areaResultSchema`). */
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
        /** Answers partly right, each earning its share of a point. */
        partial: z.int(),
        /** The share of a right answer each wrong one took away. */
        penalty: z.number(),
        right: z.int(),
        wrong: z.int(),
      })
      .nullable(),
    plannedMinutes: z.number(),
    preparation: z.object({ after: z.number(), before: z.number() }).nullable(),
    /** The same measure on the goal's previous mock, for "+16 since the last one". */
    previous: z.number().nullable(),
    scoring: z.enum(MOCK_SCORINGS),
    /** Each topic it asked, in the order it first came up; empty when it asked no topics. */
    topics: z.array(topicResultSchema),
    total: z.int(),
    /** Questions still unanswered when a section's time ran out. */
    unansweredAtTimeout: z.int(),
  })
  .meta({ id: "MockResult" });

export type MockResult = z.infer<typeof mockResultSchema>;

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
  /** On the break between two sections: when the next one's clock starts (it can start earlier). */
  breakUntil: string | null;
  canMove: boolean;
  /**
   * Once it's over, the one milestone not shown yet (a belt it crossed, new glasses), for a
   * full-screen moment before its result; null before it's over and once it's been shown.
   */
  ceremony: MilestoneView | null;
  checklist: ExamDayChecklistItem[];
  current: MockCurrentSection | null;
  /** The session's day, YYYY-MM-DD. */
  date: string;
  /** Which exam day it copies, when the exam runs over several days. */
  day: number | null;
  /** The rubric its essays are graded by; null when it asks none. */
  essayRubric: EssayView["rubric"] | null;
  /** What it leaves out of the real exam, each with why (see `MockLeftOut`). */
  leftOut: MockLeftOut[];
  /** A full mock's essays once it's over, each with its grade or why there's none yet. */
  essays: MockEssayView[];
  /** What the exam's official documents are, for the screen's words (see `ExamDocument`). */
  examDocument: ExamDocument;
  examName: string | null;
  /**
   * The exam's questions for what it sits, when it asks fewer (`MockConditions.examQuestions`):
   * the screen says how many it asks of them. Null when it asks them all.
   */
  examQuestions: number | null;
  fullLength: boolean;
  goalId: string | null;
  minutes: number;
  /**
   * Once it's over, what it did to the day's missions (its own and its speaking paper's calls'),
   * on every read while that day is the learner's (see `loadMockMissionMoment`); null otherwise.
   */
  missionMoment: MissionMomentView | null;
  mistakes: { cause: MistakeCause | null; count: number }[];
  /** "Mock exam 3": this goal's mocks, counting this one. */
  number: number;
  /**
   * What it takes to pass, in the notice's own words (such as at least half of the answers right),
   * for a mock of the whole exam (see `getPassMarks`); null for a part of it, or an exam without a
   * pass mark.
   */
  passMarks: PassMarks | null;
  /** The plan item it plays, whose intro is the challenge page; null for an unplanned one. */
  planItemId: string | null;
  purpose: MockPurpose;
  questions: number;
  /** Once it's over, the belt level and the tenth of Energy it took the learner to. */
  reached: Reached;
  result: MockResult | null;
  /**
   * Questions it asks that the learner answered before, because the bank had no new ones left for
   * them: the ones they missed first, then the ones answered longest ago. The screen says so.
   */
  reusedQuestions: number;
  review: MockReviewEntry[];
  scoring: MockScoring;
  /** The exam's own words on scoring, such as "A wrong answer cancels a right one." */
  scoringNote: string | null;
  sections: MockSectionView[];
  /** The study session it was played in; null for a mock taken any time. */
  sessionId: string | null;
  /** What a mock taken any time sits (a whole day, half of one, a subject); null for the plan's. */
  shape: MockShape | null;
  /** What its result says about the real score (see `MockScoreNotes`). */
  scoreNotes: MockScoreNotes;
  /**
   * Its speaking paper once the learner reached its speaking section and started it: each task a
   * live call, and the paper's estimate once every task is graded (see `startMockSpeaking`).
   */
  speaking: SpeakingSectionView | null;
  /** Where its number of questions, split and time come from (see `MockSizeSource`). */
  sizeSource: MockSizeSource;
  /** When the real exam starts, in its own time zone, so the mock can match it. */
  startTime: string | null;
  /**
   * `expired`: its time ran out while the learner was away with most of it unanswered (see
   * `hasTimeRunOutAway`), so it isn't scored or counted toward preparation; the learner starts a
   * new one.
   */
  status: "expired" | "finished" | "ready" | "running";
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
  })
  .strict()
  .meta({ id: "AnytimeMockInput" });

export type AnytimeMockInput = z.infer<typeof anytimeMockInputSchema>;

/** A mock the learner can take any time, with its honest size (see `MockOption`). */
export type MockOptionView = MockShape & {
  /** The notice's subjects it asks, in its words. */
  areas: string[];
  /**
   * The exam day's sections it sits, by the notice's names ("Listening", "Reading"), when it
   * leaves one out that isn't a written part (IELTS's Speaking): what it covers, said plainly.
   * Null when it sits every such section, and for a subject's mock.
   */
  covers: string[] | null;
  /**
   * About how long it takes: learners' real pace on this exam's mocks, or the exam's own pace
   * until there's enough of it; never more than `minutes`.
   */
  estimatedMinutes: number;
  /** The exam's time for it, which its clock gives. */
  minutes: number;
  /** What it leaves out of the real exam, each with why (see `MockLeftOut`). */
  leftOut: MockLeftOut[];
  /** The exam day also has a written part (an essay, a discursive test) this mock leaves out. */
  objectiveOnly: boolean;
  questions: number;
  /** The written parts a full mock asks, as the notice names them, beside its questions. */
  written: string[];
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
  /** What the exam's official documents are, for the screen's words (see `ExamDocument`). */
  examDocument: ExamDocument;
  examName: string;
  /** Where the options' number of questions, split and time come from (see `MockSizeSource`). */
  sizeSource: MockSizeSource;
  goalId: string;
  /**
   * The goal's latest mock (the first of the exam's history, `ExamMockSummary`), so the learner
   * sees how the last one went before picking the next; null before the first.
   */
  lastMock: ExamMockSummary | null;
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
