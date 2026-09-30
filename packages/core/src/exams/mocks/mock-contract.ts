import { type MistakeCause } from "@zoonk/db";
import { z } from "zod";
import { type ExamDayChecklistItem } from "../../checkpoints/weekly-challenge-rules";
import { answerTimeZoneSchema } from "../../learner/contract";
import { type TrueFalseLabels } from "../../library/exams/true-false-labels";
import { type ItemCitation } from "../../library/sources/source-citation";

/**
 * How a mock is scored, from the blueprint: item response theory (ENEM), wrong-cancels-right
 * (Cebraspe) or plain right answers.
 */
export const MOCK_SCORINGS = ["irt", "net", "raw"] as const;

export type MockScoring = (typeof MOCK_SCORINGS)[number];

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
  scoring: z.enum(MOCK_SCORINGS),
  sections: z.array(mockSectionSchema),
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
  itemId: string;
  /** Its number across the whole mock, as the answer sheet counts. */
  number: number;
  options: string[] | null;
  question: string;
  skillId: string;
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
 * The mock screen, the same for both modes (the Big Challenge in Fun, the weekly mock exam in
 * Focus): before it starts, the exam's conditions and the day's checklist; while it runs, the
 * current section's questions, its deadline and the learner's drafts; once it's over, what it
 * showed, the mistakes by cause and the questions to review.
 */
export type MockView = {
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
  questions: number;
  result: MockResult | null;
  review: MockReviewEntry[];
  scoring: MockScoring;
  /** The exam's own words on scoring, such as "A wrong answer cancels a right one." */
  scoringNote: string | null;
  sections: MockSectionView[];
  sessionId: string;
  /** When the real exam starts, in its own time zone, so the mock can match it. */
  startTime: string | null;
  status: "finished" | "ready" | "running";
  timeZone: string | null;
  /** The words the exam's true-or-false statements are answered with. */
  trueFalseLabels: TrueFalseLabels;
};
