import { type SpeakingMockExam } from "../../language/conversations/conversation-contract";
import { type EstimatedScore } from "../../preparation/estimated-score";
import { type ExamDay } from "../_utils/exam-calendar";
import { type TargetCutoff } from "../cutoffs/target-cutoff-contract";
import { type ExamDayChecklistKey, type ExamStage } from "../final-stretch/final-stretch-rules";
import { type ExamMap } from "../map/exam-map";
import {
  type MockPurpose,
  type MockResult,
  type MockScoring,
  type MockShape,
} from "../mocks/mock-contract";
import { type ExamResultView } from "../results/exam-result-contract";
import { type ExamScale } from "../scoring/exam-scales";

/**
 * What the day before the test holds: a light review, or in a plan for a test days away, the class
 * test's short mock (a full review of every topic when the learner's plan has no mocks), or (with
 * the test tomorrow) the topics that come up most, with or without the mock.
 */
export const DAY_BEFORE_PLANS = ["learn", "learnAndMock", "light", "mock", "review"] as const;

export type DayBeforePlan = (typeof DAY_BEFORE_PLANS)[number];

/**
 * The plan's next mock exam, whose intro (its plan item's challenge page) opens before its day: a
 * short one (half the exam day) on regular weeks, the whole exam in the final stretch.
 */
export type ExamNextMock = {
  /** Its day, YYYY-MM-DD; null for one without a day. */
  date: string | null;
  fullLength: boolean;
  planItemId: string;
  questions: number;
};

/** One finished mock in the goal's history, measured in the exam's own terms. */
export type ExamMockSummary = {
  /**
   * The id its result opens by: its session block's for a mock the plan scheduled, its own for one
   * taken any time. Null for a scheduled mock whose session is gone.
   */
  blockId: string | null;
  correct: number;
  finishedAt: string;
  /** The IRT score, the net score or the percent right, by `scoring`. */
  measure: number;
  number: number;
  /** Why it was taken: the plan's weekly mock, one taken any time, or placement in onboarding. */
  purpose: MockPurpose;
  scoring: MockScoring;
  /** What a mock taken any time sat (a day, half of one, a subject); null for the plan's. */
  shape: MockShape | null;
  total: number;
};

/**
 * One sitting of the exam as its notice sets it: its day number, its date, how long it runs and
 * what it holds.
 */
export type ExamFormatDay = {
  /** YYYY-MM-DD, from the exam's calendar; null when the calendar doesn't have that day. */
  date: string | null;
  /** The notice's day, from 1. */
  day: number;
  /** The day's time in minutes; null when the notice doesn't give every part's. */
  minutes: number | null;
  /** The day's parts in the notice's order and words; `written` ones (an essay) have no questions. */
  parts: { name: string; questions: number | null; written: boolean }[];
};

/**
 * The exam screen ("Your exam"): when it is and where the learner
 * stands against it, the exam map, how the exam is scored with the strategy that follows
 * (Cebraspe's leave-blank rule with the learner's calibration), the mocks so far, the estimated
 * score after a mock, and after the exam, the official result the learner reports.
 */
export type ExamView = {
  /** Cebraspe exams: how often the learner is right when sure and when unsure, across mocks. */
  calibration: MockResult["calibration"];
  /** Rehearsing the real exam day, shown the day before and on the day. */
  checklist: ExamDayChecklistKey[];
  /**
   * The last published cut-off of the learner's target (a course at an institution, a position),
   * with its source: where the bar was, never a promise. Null when none was found.
   */
  cutoff: TargetCutoff | null;
  /** What the day before holds, from the plan (a class test's short mock takes it). */
  dayBefore: DayBeforePlan;
  days: ExamDay[];
  /**
   * The days are the ones the exam usually falls on, estimated for the year the learner prepares
   * for until its notice is out.
   */
  daysEstimated: boolean;
  daysLeft: number | null;
  estimate: EstimatedScore | null;
  examName: string;
  /** The exam day by day as its notice sets it out; empty when the notice doesn't state it. */
  format: ExamFormatDay[];
  goalId: string;
  map: ExamMap | null;
  mocks: ExamMockSummary[];
  /**
   * Mock exams come with Plus and the learner's plan doesn't include them: the page shows them
   * (the next one, a mock to take now) locked, with what Plus unlocks.
   */
  mocksRequirePlus: boolean;
  /** The plan's next weekly mock; null when the next checkpoint isn't one, or there's none left. */
  nextMock: ExamNextMock | null;
  /** What it takes to pass, as the notice says it (see `getPassMarks`); empty when it doesn't. */
  passMarks: string[];
  result: ExamResultView | null;
  /**
   * `scale`: the exam's own scale (SAT, AP, TOEFL) that estimates and results use. `stated`: the
   * notice says how the exam is scored; otherwise `method` is the mocks' default (a class test
   * from the learner's material, a notice that doesn't say), which no advice is drawn from.
   */
  scoring: { method: MockScoring; note: string | null; scale: ExamScale | null; stated: boolean };
  /** The learner did what their plan asked before today (see `ExamMomentView`). */
  prepared: boolean;
  /** "You did 38 sessions and 3 mock exams": the work behind the day before. */
  sessionsDone: number;
  /** The score the learner said they aim for, in their words ("750"); null when they gave none. */
  targetScore: string | null;
  /**
   * IELTS and TOEFL iBT: the exam whose speaking test runs as a live call graded by its criteria,
   * as the language goal had it. Null for other exams.
   */
  speakingMock: SpeakingMockExam | null;
  stage: ExamStage;
  timeZone: string | null;
};

/**
 * The exam's moment on Today, only when there's one: the final stretch, the light day before
 * with its checklist, the exam day, and after it, "How did it go?" until the result is in.
 */
export type ExamMomentView = {
  checklist: ExamDayChecklistKey[];
  /** What the day before holds, from the plan (a class test's short mock takes it). */
  dayBefore: DayBeforePlan;
  /** The next exam day (or the last one after the exam), with its start time. */
  day: ExamDay | null;
  examName: string;
  mocksTaken: number;
  /**
   * The learner did what their plan asked before today (no lessons left from earlier days, and at
   * least one session): only then does the moment say they prepared.
   */
  prepared: boolean;
  resultReported: boolean;
  sessionsDone: number;
  stage: Exclude<ExamStage, "preparing">;
  timeZone: string | null;
};
