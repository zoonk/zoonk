import { type SpeakingMockExam } from "../../language/conversations/conversation-contract";
import { type SpeakingPaperView } from "../../language/exam-speaking/speaking-contract";
import { type PassMarks } from "../../library/exams/pass-marks";
import { type NoSitting, type NoticeDay } from "../../plans/plan-view-contract";
import { type EstimatedScore } from "../../preparation/estimated-score";
import { type TargetCutoff } from "../cutoffs/target-cutoff-contract";
import { type ExamDocument } from "../exam-document";
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

/** One exam day: its ISO date, the notice's name for it ("Day 1") and its start time. */
export type ExamDay = { date: string; label: string | null; startTime: string | null };

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

/**
 * A mock the learner started and hasn't finished (one taken any time, or the plan's weekly one),
 * which the exam's page leads its mocks with: how much of it is answered and when its clock runs
 * out. One whose time ran out while the learner was away isn't running (see `hasTimeRunOutAway`).
 */
export type ExamRunningMock = {
  /** Its questions with an answer so far, essays included. */
  answered: number;
  /**
   * When the clock of the section it's on runs out (ISO): the one the learner sees on opening it,
   * the next section's once a break ends. Past it, the mock waits to be handed in. Null once every
   * section is handed in and it only waits to be graded.
   */
  deadline: string | null;
  /** The id it opens by: its session block's for the plan's weekly mock, its own otherwise. */
  id: string;
  /** Its place among the goal's mocks, as the mock names itself: "Mock exam 2". */
  number: number;
  purpose: MockPurpose;
  /** Its questions, essays included. */
  questions: number;
  /** What one taken any time sits (a day, half of one, a subject); null for the plan's. */
  shape: MockShape | null;
};

/** One finished mock in the goal's history, measured in the exam's own terms. */
export type ExamMockSummary = {
  /**
   * The id its result opens by: its session block's for a mock the plan scheduled, its own for one
   * taken any time. Null for a scheduled mock whose session is gone.
   */
  blockId: string | null;
  correct: number;
  /** The exam's questions for what it sat, when it asked fewer (`MockConditions.examQuestions`). */
  examQuestions: number | null;
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

/** One finished mock on the progress chart. */
type ExamProgressMock = {
  finishedAt: string;
  number: number;
  /**
   * Its score as a share of its questions, from 0 to 100: its right answers, or for `net` scoring
   * its net score (right minus wrong), which can fall below 0.
   */
  percent: number;
  purpose: MockPurpose;
  shape: MockShape | null;
};

/** One of the notice's subjects across the mocks that asked it. */
export type ExamSubjectTrend = {
  /** Points from its first mock to its latest; null until two mocks asked it. */
  change: number | null;
  name: string;
  /** Its share right in each mock that asked it, oldest first. */
  percents: number[];
};

/**
 * How the learner's mocks went over time: each one's score (the latest twenty, oldest first),
 * each subject's trend, the subjects that got better since their first mock (by ten points or
 * more) and the ones that still need work (below 60% in their latest mock), at most two each.
 */
export type ExamMockProgress = {
  improved: string[];
  mocks: ExamProgressMock[];
  needsWork: string[];
  subjects: ExamSubjectTrend[];
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
  /** What the exam's official documents are, for the page's words (see `ExamDocument`). */
  examDocument: ExamDocument;
  examName: string;
  /** The exam day by day as its notice sets it out; empty when the notice doesn't state it. */
  format: ExamFormatDay[];
  goalId: string;
  map: ExamMap | null;
  mocks: ExamMockSummary[];
  /**
   * The one day is the start of the month the learner named ("in March"), which stands for that
   * month: the page says the month, not a day in it.
   */
  namedMonth: boolean;
  /** The exam day the notice gives when the plan counts down to another (see `getNoticeDay`). */
  noticeDay: NoticeDay | null;
  /** The learner's month has no sitting of their exam (see `NoSitting`); null otherwise. */
  noSitting: NoSitting | null;
  /**
   * Mock exams come with Plus and the learner's plan doesn't include them: the page shows them
   * (the next one, a mock to take now) locked, with what Plus unlocks.
   */
  mocksRequirePlus: boolean;
  /**
   * The plan's next weekly mock; null when the next checkpoint isn't one, there's none left, or
   * it's a mock running (its row in `runningMocks` stands for it then).
   */
  nextMock: ExamNextMock | null;
  /**
   * How the learner's mocks went over time; null before the first one, and when mocks need Plus
   * (`mocksRequirePlus`), where the page shows it locked.
   */
  progress: ExamMockProgress | null;
  /**
   * What it takes to pass, as the notice says it (see `getPassMarks`); none when it doesn't, or
   * when the scale already says it in the learner's language (`scoring.noticeScale.passScore`).
   */
  passMarks: PassMarks | null;
  result: ExamResultView | null;
  /**
   * The mocks the learner started and hasn't finished: the one taken any time first (the page's
   * main action continues it), then the plan's weekly one, which can run beside it. Empty when
   * none is running.
   */
  runningMocks: ExamRunningMock[];
  /**
   * `scale`: the exam's own scale (SAT, AP, TOEFL) that estimates and results use. `stated`: the
   * notice says how the exam is scored; otherwise `method` is the mocks' default (a class test
   * from the learner's material, a notice that doesn't say), which no advice is drawn from.
   */
  scoring: {
    /** How the exam's mocks score it. */
    method: MockScoring;
    note: string | null;
    /**
     * The scale the notice says the exam reports its score on (EXANI-II's 700 to 1300), with the
     * score that passes on it; null when the notice states none.
     */
    noticeScale: { max: number; min: number; name: string | null; passScore: number | null } | null;
    /**
     * The notice's rule that changes how to answer: item response theory (any exam scored that
     * way), wrong answers costing points (`wrongPenalty`), or each right answer a point; null when
     * the notice doesn't say how the exam is scored.
     */
    rule: "irt" | "net" | "raw" | null;
    scale: ExamScale | null;
    stated: boolean;
    /** The share of a right answer each wrong one takes away; 0 where wrong answers cost nothing. */
    wrongPenalty: number;
  };
  /** The learner did what their plan asked before today (see `ExamMomentView`). */
  prepared: boolean;
  /** "You did 38 sessions and 3 mock exams": the work behind the day before. */
  sessionsDone: number;
  /** The score the learner said they aim for, in their words ("750"); null when they gave none. */
  targetScore: string | null;
  /**
   * DELE, DELF or DALF, the Goethe-Zertifikat and Cambridge English: the exam's speaking paper, its
   * tasks practiced one at a time on a live call with the AI as examiner or partner (Plus). Null
   * for other exams.
   */
  speaking: SpeakingPaperView | null;
  /**
   * IELTS and TOEFL iBT: the exam whose speaking test runs as a live call graded by its criteria,
   * as the language goal had it. Null for other exams.
   */
  speakingMock: SpeakingMockExam | null;
  /** The speaking mock cannot start while live calls are paused. */
  speakingMockPaused: boolean;
  stage: ExamStage;
  timeZone: string | null;
  /** What the notice lets candidates use or gives them, for exam day's checklist. */
  tools: string[];
};

/**
 * The exam's moment on Today, only when there's one: the final stretch, the light day before
 * with its checklist, the exam day, and after it, "How did it go?" until the result is in.
 */
export type ExamMomentView = {
  checklist: ExamDayChecklistKey[];
  /** What the notice lets candidates use or gives them, beside the checklist; empty without it. */
  tools: string[];
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
