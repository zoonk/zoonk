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

export const DAY_BEFORE_PLANS = ["learn", "learnAndMock", "light", "mock", "review"] as const;

export type DayBeforePlan = (typeof DAY_BEFORE_PLANS)[number];

export type ExamDay = { date: string; label: string | null; startTime: string | null };

export type ExamNextMock = {
  date: string | null;
  fullLength: boolean;
  planItemId: string;
  questions: number;
};

export type ExamRunningMock = {
  answered: number;
  deadline: string | null;
  id: string;
  number: number;
  purpose: MockPurpose;
  questions: number;
  shape: MockShape | null;
};

export type ExamMockSummary = {
  blockId: string | null;
  correct: number;
  examQuestions: number | null;
  finishedAt: string;
  measure: number;
  number: number;
  purpose: MockPurpose;
  scoring: MockScoring;
  shape: MockShape | null;
  total: number;
};

type ExamProgressMock = {
  finishedAt: string;
  number: number;
  percent: number;
  purpose: MockPurpose;
  shape: MockShape | null;
};

export type ExamSubjectTrend = { change: number | null; name: string; percents: number[] };

export type ExamMockProgress = {
  improved: string[];
  mocks: ExamProgressMock[];
  needsWork: string[];
  subjects: ExamSubjectTrend[];
};

export type ExamFormatDay = {
  date: string | null;
  day: number;
  minutes: number | null;
  parts: { name: string; questions: number | null; written: boolean }[];
};

export type ExamView = {
  calibration: MockResult["calibration"];
  checklist: ExamDayChecklistKey[];
  cutoff: TargetCutoff | null;
  dayBefore: DayBeforePlan;
  days: ExamDay[];
  daysEstimated: boolean;
  daysLeft: number | null;
  estimate: EstimatedScore | null;
  examDocument: ExamDocument;
  examName: string;
  format: ExamFormatDay[];
  goalId: string;
  map: ExamMap | null;
  mocks: ExamMockSummary[];
  namedMonth: boolean;
  noticeDay: NoticeDay | null;
  noSitting: NoSitting | null;
  mocksRequirePlus: boolean;
  nextMock: ExamNextMock | null;
  progress: ExamMockProgress | null;
  passMarks: PassMarks | null;
  result: ExamResultView | null;
  runningMocks: ExamRunningMock[];
  scoring: {
    method: MockScoring;
    note: string | null;
    noticeScale: { max: number; min: number; name: string | null; passScore: number | null } | null;
    rule: "irt" | "net" | "raw" | null;
    scale: ExamScale | null;
    stated: boolean;
    wrongPenalty: number;
  };
  prepared: boolean;
  sessionsDone: number;
  targetScore: string | null;
  speaking: SpeakingPaperView | null;
  speakingMock: SpeakingMockExam | null;
  speakingMockPaused: boolean;
  stage: ExamStage;
  timeZone: string | null;
  tools: string[];
};

export type ExamMomentView = {
  checklist: ExamDayChecklistKey[];
  tools: string[];
  dayBefore: DayBeforePlan;
  day: ExamDay | null;
  examName: string;
  mocksTaken: number;
  prepared: boolean;
  resultReported: boolean;
  sessionsDone: number;
  stage: Exclude<ExamStage, "preparing">;
  timeZone: string | null;
};
