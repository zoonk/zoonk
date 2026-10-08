import { type PlanChangeStatus, type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { type LanguageActivityType } from "../language/activities/language-activities";
import { type OwnLevel } from "../learner/placement/placement-steps";
import { type PlanStatus } from "../preparation/plan-status";
import { type PlanOperation } from "./plan-contract";
import { type PlanCourseView } from "./plan-course-contract";
import { type ToolChoice, type ToolSystem } from "./plan-tools-contract";
import { type PlanEffect } from "./planner/plan-effect";
import {
  type DifficultyBias,
  type LightWeek,
  type PaceSource,
  type PlanPhaseKind,
  type PracticeBias,
} from "./planner/plan-state";
import { type WrittenPractice } from "./written-practice-contract";

/** A change to the plan, announced in one plain sentence with an undo. */
export type PlanChangeView = {
  /** Only the latest applied edit and test-outs can be undone; past work never is. */
  canUndo: boolean;
  createdAt: string;
  /**
   * For `missedDays`, when falling behind made the plan cover less of its goal by its date: what it
   * covered before and now, and the daily time to offer (see `FallingBehind`). Null when the date
   * isn't at risk.
   */
  behind: {
    canFocus: boolean;
    coveredAfter: number;
    coveredBefore: number;
    currentMinutes: number;
    dailyMinutes: number | null;
    fullDepth: boolean;
    measure: "exam" | "goal";
  } | null;
  /** For `missedDays`: the earlier days that left lessons, now first on the plan. */
  days: number | null;
  effect: PlanEffect | null;
  id: string;
  kind: string;
  /** Lessons a test-out skipped. */
  lessonsSkipped: number;
  /**
   * The exam day the notice officially sets, when the change moves the goal's date off it: the
   * learner applies it only knowing that ("use my date anyway"). Null otherwise.
   */
  officialDate: { date: string; source: string | null } | null;
  operations: PlanOperation[];
  /**
   * The sentence to show as written, in the learner's language, when an AI or a proposal wrote it.
   * Null when the app says it from `kind`, `operations` and `effect`.
   */
  reason: string | null;
  /** The learner said "Got it" to it, so the plan no longer shows it. */
  seen: boolean;
  source: string;
  status: PlanChangeStatus;
  /**
   * For a change the learner made or applied: `changed` when today's session took it right away,
   * `unchanged` when today's session stays as it was (underway or done), so it starts on the next
   * study day. Null otherwise.
   */
  todaySession: "changed" | "unchanged" | null;
};

export type PlanItemView = {
  chapterId: string | null;
  id: string;
  kind: PlanItemKind;
  lessonId: string | null;
  minutes: number | null;
  /** Free exam plans cover the diagnostic, the plan and its first week; mocks and the rest need Plus. */
  requiresPlus: boolean;
  scheduledFor: string | null;
  skillId: string | null;
  status: PlanItemStatus;
  /** The lesson's title; for a skill whose lessons are still being written, its course's. */
  title: string;
  /**
   * A skill whose lessons the Library is still writing, planned as one stand-in. Its `title` is
   * the course it's taught in (empty when unknown), never the skill's raw name.
   */
  writing: boolean;
};

/**
 * A chapter of a phase: "Functions and graphs, 3 of 8 lessons". Only the current phase has a
 * `current` chapter (the one holding the next lesson). Skills whose lessons are still being written
 * group under their course's title as one `writing` row until their chapters exist; their lesson
 * counts are stand-ins, so apps say "being written" instead. Skills placement tested out before
 * their lessons were written are one finished row under the same title.
 */
export type PlanChapterView = {
  chapterId: string | null;
  lessonsDone: number;
  lessonsTotal: number;
  /**
   * The skills a row of stand-ins placement settled before their lessons were written, by name in
   * plan order: apps name the row by them, not by its course's `title`, since the learner knows
   * these skills, not the course. Empty for every other row.
   */
  skills: string[];
  state: "current" | "done" | "upcoming";
  /**
   * Every lesson in it was tested out (placement or a test-out), so it's done without being
   * studied: apps say "You already know this", so a course-titled row never reads as the course.
   */
  testedOut: boolean;
  title: string;
  writing: boolean;
};

/**
 * What a day of a short plan (a test days away) is for: the exam map and the learner's gaps,
 * practice, the class test's short mock with a review of what it finds, or a public exam's light
 * review.
 */
export const SHORT_EXAM_FOCUSES = [
  "mapAndGaps",
  "practice",
  "mockAndReview",
  "lightReview",
] as const;

export type ShortExamFocus = (typeof SHORT_EXAM_FOCUSES)[number];

/**
 * The study days a phase of a short plan covers ("Days 1 to 4") and what they're for: the exam
 * map and gaps, practice, or the last day (the short mock and its review, or a light review).
 */
export type ShortPhaseView = { firstDay: number; focus: ShortExamFocus; lastDay: number };

/**
 * The checkpoint that closes a phase (the Trickster), by its plan item, whose page is its intro:
 * `done` once passed, its planned day while it's ahead.
 */
export type PlanPhaseCheckpointView = {
  date: string | null;
  planItemId: string;
  state: "done" | "upcoming";
};

export type PlanPhaseView = {
  chapterCount: number;
  /** Every phase's chapters in plan order, so a done or later phase opens like the current one. */
  chapters: PlanChapterView[];
  /** Null for a phase without one. */
  checkpoint: PlanPhaseCheckpointView | null;
  endDate: string | null;
  hours: number;
  index: number;
  kind: PlanPhaseKind;
  lessonsDone: number;
  lessonsTotal: number;
  milestone: string | null;
  /** The phase's mock exams: how many, and the day of the next one still to take. */
  mocks: { count: number; nextDate: string | null };
  /** Empty for exam phases, which the apps name by kind. */
  name: string;
  /** Its days in a short plan (a test days away); null in any other plan. */
  short: ShortPhaseView | null;
  startDate: string | null;
  state: "current" | "done" | "upcoming";
};

export type PlanDayView = {
  date: string;
  items: PlanItemView[];
  minutes: number;
  state: "done" | "missed" | "rest" | "today" | "upcoming";
};

/** A tool on the "You'll use" card: one the plan's chapters use, with what the learner chose. */
export type PlanToolView = {
  /** Null until the learner says they have it, they'll set it up, or they'll go without. */
  choice: ToolChoice | null;
  /** True when any of the plan's chapters needs it to practice; false when it only helps. */
  essential: boolean;
  /** Only later phases use it, so the card lists it under "More later" instead of asking now. */
  later: boolean;
  name: string;
  /** The device the setup lesson is for, when they'll set it up. */
  system: ToolSystem | null;
};

/** The plan at three zoom levels (until the goal, this week, and the changes). */
export type PlanView = {
  access: { freeUntil: string | null; mocksRequirePlus: boolean };
  areas: {
    /** The part of the area in focus, as the learner named it; null when it's focused whole. */
    focusPart: string | null;
    focused: boolean;
    name: string;
    /** The learner said they're past its basics: it starts past its foundations. */
    pastBasics: boolean;
    /** The learner wants less of it: it keeps its core, and its depth goes to other areas first. */
    reduced: boolean;
    skillCount: number;
    skipped: boolean;
  }[];
  changes: PlanChangeView[];
  /** The Library course the plan is built from, with its levels; null without one. */
  course: PlanCourseView | null;
  currentPhase: number | null;
  estimate: {
    endDate: string | null;
    pace: { factor: number; source: PaceSource } | null;
    remainingHours: number;
    totalHours: number;
  };
  feasibility: {
    alternative: { dailyMinutes: number; endDate: string | null } | null;
    /** Every topic (every skill's core) is in the plan; false only when even the cores don't fit. */
    coreFits: boolean;
    /** When the cores don't all fit: the fewest daily minutes that bring every topic in. */
    coreMinutes: number | null;
    /** The share of everything, in depth, the plan covers (see `measure`). */
    coveredShare: number;
    deadline: string | null;
    fits: boolean;
    /** When no daily time covers everything: what the most time a day covers, when it's more. */
    maximum: { coveredShare: number; dailyMinutes: number } | null;
    /** A share of the exam's questions and points, or of the goal's skills by their weight. */
    measure: "exam" | "goal";
    /** The daily minutes that study everything in depth. */
    recommendedMinutes: number | null;
  } | null;
  /** Every lesson and chapter is behind the learner: time for what to study next. */
  finished: boolean;
  goalId: string;
  /**
   * An exam plan built before research read the exam's notice: `reading` while the reveal waits
   * for that reading, `usual` once the wait ended without it (the plan follows the exam's usual
   * structure, and the reading arrives as a change to apply). Null otherwise.
   */
  notice: "reading" | "usual" | null;
  /** The level the learner gave (nothing yet to advanced), which they can change from the plan. */
  ownLevel: OwnLevel | null;
  phases: PlanPhaseView[];
  planId: string;
  /** False while the planner is still building the plan. */
  ready: boolean;
  /**
   * A test at most a week away, planned day by day: its study days and the day of its short mock
   * (a class test rehearses the day before). Null for any other plan.
   */
  shortPlan: { days: number; mockDate: string | null } | null;
  schedule: {
    dailyMinutes: number;
    lightWeeks: LightWeek[];
    studyDays: number;
    targetDate: string | null;
    /** The date is the likely day of an edition whose notice isn't out yet. */
    targetDateEstimated: boolean;
    /** Minutes per weekday, Sunday first; 0 for rest days. */
    weekdayMinutes: number[];
  };
  status: PlanStatus | null;
  steering: {
    difficultyBias: DifficultyBias;
    /**
     * Lessons of this plan the learner studied (not the ones placement skipped): "too easy" or
     * "too hard" means something only after the first one.
     */
    lessonsStudied: number;
    practiceBias: PracticeBias;
    /** Language practice the learner left out ("I don't need writing"); empty for other goals. */
    skippedActivities: LanguageActivityType[];
  };
  /** "You'll use": the tools the plan's chapters use, essential first. Empty when none do. */
  tools: PlanToolView[];
  week: { days: PlanDayView[]; endDate: string; startDate: string };
  /**
   * When the exam's written tests are practiced, which the learner chooses. Null for plans without
   * written tests and plans for a test days away.
   */
  writtenPractice: WrittenPractice | null;
};
