import { type PlanChangeStatus, type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { type BossTiming } from "../checkpoints/_utils/boss-reached";
import { type ExamChoiceView } from "../exams/choices/exam-choice-contract";
import { type ExamDocument } from "../exams/exam-document";
import { type LanguageActivityType } from "../language/activities/language-activities";
import { type OwnLevel } from "../learner/placement/placement-steps";
import { type PlanStatus } from "../preparation/plan-status";
import { type WeeklyStudyTime } from "../progress/weekly-study-time-contract";
import { type MockFundingView } from "./mock-funding-contract";
import { type PlanNumbers } from "./numbers-contract";
import { type LearnerPlanOperation, type PlanOperation } from "./plan-contract";
import { type PlanCourseView } from "./plan-course-contract";
import { type ToolChoice, type ToolSystem } from "./plan-tools-contract";
import { type PlanEffect } from "./planner/plan-effect";
import {
  type BaseChoice,
  type DifficultyBias,
  type LightWeek,
  type PaceSource,
  type PlanPhaseKind,
  type PracticeBias,
} from "./planner/plan-state";
import { type WeekShape } from "./planner/week-shape";
import { type WrittenPractice } from "./written-practice-contract";

export type NoticeDay = { date: string; estimated: boolean };

export type NoSitting = { closest: string[]; month: string };

export type PlanChangeView = {
  canApply: boolean;
  canUndo: boolean;
  createdAt: string;
  behind: {
    canFocus: boolean;
    coveredAfter: number;
    coveredBefore: number;
    currentMinutes: number;
    measure: "exam" | "goal";
  } | null;
  days: number | null;
  effect: PlanEffect | null;
  examDocument: ExamDocument;
  id: string;
  kind: string;
  lessonsSkipped: number;
  officialDate: { date: string; source: string | null } | null;
  operations: PlanOperation[];
  /** Null when the app words the change from `kind`, `operations` and `effect`. */
  reason: string | null;
  seen: boolean;
  source: string;
  status: PlanChangeStatus;
  todaySession: "changed" | "unchanged" | null;
};

export type PlanItemView = {
  chapterId: string | null;
  id: string | null;
  kind: PlanItemKind;
  lessonId: string | null;
  minutes: number | null;
  requiresPlus: boolean;
  scheduledFor: string | null;
  skillId: string | null;
  status: PlanItemStatus;
  title: string;
  writing: boolean;
};

export type PlanChapterView = {
  chapterId: string | null;
  deeper: boolean;
  far: boolean;
  lessonsDone: number;
  lessonsTotal: number;
  nextDate: string | null;
  plannedLessons: number | null;
  skillId: string | null;
  skills: string[];
  state: "current" | "done" | "upcoming";
  testedOut: boolean;
  title: string;
  writing: boolean;
};

export const SHORT_EXAM_FOCUSES = [
  "mapAndGaps",
  "practice",
  "mockAndPractice",
  "mockAndReview",
  "lightReview",
] as const;

export type ShortExamFocus = (typeof SHORT_EXAM_FOCUSES)[number];

export type ShortPhaseView = { firstDay: number; focus: ShortExamFocus; lastDay: number };

type PlanEndView = { kind: "finished" };

export type PlanOffer = { effect: PlanEffect; fits: boolean; operations: LearnerPlanOperation[] };

export type PlanPhaseCheckpointView = {
  locked: boolean;
  date: string | null;
  planItemId: string | null;
  state: "done" | "upcoming";
  when: BossTiming;
};

export type PlanPhaseView = {
  chapterCount: number;
  chapters: PlanChapterView[];
  checkpoint: PlanPhaseCheckpointView | null;
  endDate: string | null;
  hours: number;
  index: number;
  kind: PlanPhaseKind;
  lessonsDone: number;
  lessonsTotal: number;
  milestone: string | null;
  mocks: { count: number; nextDate: string | null };
  /** Empty for exam phases, which the apps name by kind. */
  name: string;
  short: ShortPhaseView | null;
  startDate: string | null;
  state: "current" | "done" | "leftOut" | "unfinished" | "upcoming";
};

export type PlanDayView = {
  date: string;
  items: PlanItemView[];
  minutes: number;
  mockFunding: MockFundingView | null;
  state: "done" | "missed" | "rest" | "today" | "upcoming";
};

export type PlanToolView = {
  choice: ToolChoice | null;
  essential: boolean;
  later: boolean;
  name: string;
  system: ToolSystem | null;
};

export type PlanBaseView = {
  area: string;
  choice: BaseChoice;
  choices: BaseChoice[];
  minutes: { deep: number; essential: number; quick: number };
  name: string;
  neededFor: string[];
  skillId: string;
  studied: boolean;
};

export type PlanBasesView = { daysLeft: number | null; items: PlanBaseView[]; knownCount: number };

export type MockScheduleView = {
  count: number;
  everyWeeks: number | null;
  nextDate: string;
  weekday: number | null;
};

export type PlanView = {
  access: { freeUntil: string | null; freeWeekOver: boolean; mocksRequirePlus: boolean };
  areas: {
    focusPart: string | null;
    focused: boolean;
    name: string;
    partOf: string | null;
    pastBasics: boolean;
    reduced: boolean;
    skillCount: number;
    skipped: boolean;
  }[];
  bases: PlanBasesView | null;
  changes: PlanChangeView[];
  course: PlanCourseView | null;
  currentPhase: number | null;
  estimate: {
    endDate: string | null;
    fullCourseEndDate: string | null;
    pace: { factor: number; source: PaceSource } | null;
    remainingHours: number;
    totalHours: number;
  };
  numbers: PlanNumbers | null;
  examChoices: ExamChoiceView[];
  examDocument: ExamDocument;
  feasibility: {
    coreFits: boolean;
    coveredShare: number;
    deadline: string | null;
    deepensMostAsked: boolean;
    fits: boolean;
    measure: "exam" | "goal";
    timeCovers: boolean;
  } | null;
  end: PlanEndView | null;
  goalId: string;
  notice: "reading" | "usual" | null;
  ownLevel: OwnLevel | null;
  fitOffer: (PlanOffer & { canApply: boolean }) | null;
  fundedMocks: (PlanItemView & { id: string })[];
  phases: PlanPhaseView[];
  planId: string;
  ready: boolean;
  shortPlan: { days: number; mockDate: string | null } | null;
  schedule: {
    dailyMinutes: number;
    fullCourse: boolean;
    lightWeeks: LightWeek[];
    mocks: MockScheduleView | null;
    studyDays: number;
    noticeDay: NoticeDay | null;
    noSitting: NoSitting | null;
    nextSitting: string | null;
    targetDate: string | null;
    targetDateEstimated: boolean;
    targetDateNamedMonth: boolean;
    /** Sunday first; 0 for rest days. */
    weekdayMinutes: number[];
    shape: WeekShape;
  };
  status: PlanStatus | null;
  steering: {
    difficultyBias: DifficultyBias;
    lessonsStudied: number;
    practiceBias: PracticeBias;
    skippedActivities: LanguageActivityType[];
  };
  tools: PlanToolView[];
  week: { days: PlanDayView[]; endDate: string; startDate: string };
  weekTime: WeeklyStudyTime;
  writtenPractice: WrittenPractice | null;
};
