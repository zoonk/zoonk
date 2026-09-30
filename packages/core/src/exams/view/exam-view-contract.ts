import { type SpeakingMockExam } from "../../language/conversations/conversation-contract";
import { type EstimatedScore } from "../../preparation/estimated-score";
import { type ExamDay } from "../_utils/exam-calendar";
import { type ExamDayChecklistKey, type ExamStage } from "../final-stretch/final-stretch-rules";
import { type ExamMap } from "../map/exam-map";
import { type MockResult, type MockScoring } from "../mocks/mock-contract";
import { type ExamResultView } from "../results/exam-result-contract";
import { type ExamScale } from "../scoring/exam-scales";

/**
 * What the day before the test holds: a light review, or in a plan for a test days away, the class
 * test's short mock, or (with the test tomorrow) the topics that come up most, with or without the
 * mock.
 */
export const DAY_BEFORE_PLANS = ["learn", "learnAndMock", "light", "mock"] as const;

export type DayBeforePlan = (typeof DAY_BEFORE_PLANS)[number];

/** One finished mock in the goal's history, measured in the exam's own terms. */
export type ExamMockSummary = {
  blockId: string | null;
  correct: number;
  finishedAt: string;
  /** The IRT score, the net score or the percent right, by `scoring`. */
  measure: number;
  number: number;
  scoring: MockScoring;
  total: number;
};

/**
 * The exam screen ("Your exam"), the same for both modes: when it is and where the learner
 * stands against it, the exam map, how the exam is scored with the strategy that follows
 * (Cebraspe's leave-blank rule with the learner's calibration), the mocks so far, the estimated
 * score after a mock, and after the exam, the official result the learner reports.
 */
export type ExamView = {
  /** Cebraspe exams: how often the learner is right when sure and when unsure, across mocks. */
  calibration: MockResult["calibration"];
  /** Rehearsing the real exam day, shown the day before and on the day. */
  checklist: ExamDayChecklistKey[];
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
  goalId: string;
  map: ExamMap | null;
  mocks: ExamMockSummary[];
  result: ExamResultView | null;
  /** `scale`: the exam's own scale (SAT, AP, TOEFL) that estimates and results use. */
  scoring: { method: MockScoring; note: string | null; scale: ExamScale | null };
  /** "You did 38 sessions and 3 mock exams": the work behind the day before. */
  sessionsDone: number;
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
  resultReported: boolean;
  sessionsDone: number;
  stage: Exclude<ExamStage, "preparing">;
  timeZone: string | null;
};
