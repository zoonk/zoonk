import { type PlanChangeStatus, type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { type BossTiming } from "../checkpoints/_utils/boss-reached";
import { type ExamChoiceView } from "../exams/choices/exam-choice-contract";
import { type ExamDocument } from "../exams/exam-document";
import { type LanguageActivityType } from "../language/activities/language-activities";
import { type OwnLevel } from "../learner/placement/placement-steps";
import { type PlanStatus } from "../preparation/plan-status";
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
import { type WrittenPractice } from "./written-practice-contract";

/**
 * The exam day the notice gives when the plan counts down to another (see `getNoticeDay`), offered
 * with one tap wherever the date shows. `estimated` while the edition's notice isn't out.
 */
export type NoticeDay = { date: string; estimated: boolean };

/**
 * An exam held several times a year with no sitting in the month of the learner's date
 * (`month`, its first day): the first day of the closest sittings still open for registration,
 * before and after it, each one tap away. The plan keeps the learner's date until they pick one.
 */
export type NoSitting = { closest: string[]; month: string };

/** A change to the plan, announced in one plain sentence with an undo. */
export type PlanChangeView = {
  /** Only the latest applied edit and test-outs can be undone; past work never is. */
  canUndo: boolean;
  createdAt: string;
  /**
   * For `missedDays`, when falling behind made the plan cover less of its goal by its date: what it
   * covered before and now, at the learner's time (see `FallingBehind`). Null when the date isn't
   * at risk.
   */
  behind: {
    canFocus: boolean;
    coveredAfter: number;
    coveredBefore: number;
    currentMinutes: number;
    measure: "exam" | "goal";
  } | null;
  /** For `missedDays`: the earlier days that left lessons, now first on the plan. */
  days: number | null;
  effect: PlanEffect | null;
  /** What the exam's official documents are, for a notice's change (see `ExamDocument`). */
  examDocument: ExamDocument;
  id: string;
  kind: string;
  /** Lessons a test-out skipped, counted as the Plan counts lessons (`countLessons`). */
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
  id: string | null;
  kind: PlanItemKind;
  lessonId: string | null;
  minutes: number | null;
  /** Free exam plans cover the diagnostic, the plan and its first week; mocks and the rest need Plus. */
  requiresPlus: boolean;
  scheduledFor: string | null;
  skillId: string | null;
  status: PlanItemStatus;
  /**
   * The lesson's title; for a skill whose lessons are still being written, its course's, empty for
   * the goal's own course (say "More lessons").
   */
  title: string;
  /**
   * A skill whose lessons the Library is still writing, planned as one stand-in. Its `title` is
   * the course it's taught in (empty when unknown), never the skill's raw name.
   */
  writing: boolean;
};

/**
 * A chapter of a phase: "Functions and graphs, 3 of 8 lessons". Only the current phase has a
 * `current` chapter (the one holding the next lesson). Skills whose lessons aren't written yet (the
 * plan writes them two weeks ahead) group under their course's title as one `writing` row until
 * their chapters exist; the goal's own course leaves it empty (apps say "More lessons"). One
 * starting after those weeks is `far`: apps say the lessons the plan teaches it (`plannedLessons`,
 * "about 12 lessons", or no count when unknown) and when it starts (`nextDate`), and open its
 * lessons early by its `skillId` when it has one; any other says its lessons are on the way.
 * Skills placement tested out before their lessons were written are one finished row under the
 * same title.
 */
export type PlanChapterView = {
  chapterId: string | null;
  /**
   * Its lessons go deeper into topics of an earlier phase: a learn plan short on time studies
   * every phase's core first and the rest after it, in a later phase's time (see `putCoresFirst`),
   * so the chapter shows again there. Apps say so, so it never reads as listed twice.
   */
  deeper: boolean;
  /**
   * A `writing` row starting after the two weeks the plan writes ahead: apps say the lessons the
   * plan teaches it (`plannedLessons`) and when it starts (`nextDate`), not that they're on the way.
   * False for every other row.
   */
  far: boolean;
  lessonsDone: number;
  lessonsTotal: number;
  /** The first day the plan studies it; null once it's done. */
  nextDate: string | null;
  /**
   * A `writing` row's lessons the plan teaches, after its cuts and base choices. Null for every
   * other row, and for one of a plan saved before it stored them (until its next change): say no
   * count then.
   */
  plannedLessons: number | null;
  /**
   * A `far` row's first topic no chapter teaches yet: its lesson plan is the skill's outline, which
   * the learner can ask for now. Null for every other row, including one whose topics chapters
   * already teach (the plan writes their next chapter as the learner gets close).
   */
  skillId: string | null;
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
 * practice (a public exam's opening with its mock), the class test's short mock with a review of
 * what it finds, or a public exam's light review.
 */
export const SHORT_EXAM_FOCUSES = [
  "mapAndGaps",
  "practice",
  "mockAndPractice",
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
 * A plan with nothing left to do and every lesson studied or tested out (see `isPlanFinished`):
 * apps celebrate it and show what to study next. A plan whose date came with lessons left isn't
 * over: its status says `pastDate`, and a change of date (an exam's plan going on after it) keeps
 * it going.
 */
type PlanEndView = { kind: "finished" };

/**
 * A change the Plan offers, with what it does, computed before the learner sees it so Apply is one
 * tap after its diff: the lessons the learner's own time fits (see `fitOffer`).
 */
export type PlanOffer = {
  effect: PlanEffect;
  /** The plan with the change covers everything in depth by its date, as that change plans it. */
  fits: boolean;
  operations: LearnerPlanOperation[];
};

/**
 * The checkpoint that closes a phase (the Trickster), by its plan item, whose page is its intro:
 * `done` once passed, its planned day while it's ahead.
 */
export type PlanPhaseCheckpointView = {
  /** Still visible in the path, but starting it requires Plus. */
  locked: boolean;
  date: string | null;
  planItemId: string | null;
  state: "done" | "upcoming";
  /**
   * When it comes, as sessions offer challenges and its page says (see `getBossTimings`): on its
   * `date`; in the learner's next session (`nextSession`), which duels the first one reached and
   * any whose day came; or after the challenge before it (`queued`): its phase's lessons are done,
   * and a session duels the next one once that one is won. Apps say so instead of its date. Always
   * `date` once won, and past a free exam plan's first week, whose sessions hold no challenges.
   */
  when: BossTiming;
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
  /** Its lessons the learner studied. */
  lessonsDone: number;
  /** Its lessons in the plan: every one but those tested out, which are off the plan. */
  lessonsTotal: number;
  milestone: string | null;
  /** The phase's mock exams: how many, and the day of the next one still to take. */
  mocks: { count: number; nextDate: string | null };
  /** Empty for exam phases, which the apps name by kind. */
  name: string;
  /** Its days in a short plan (a test days away); null in any other plan. */
  short: ShortPhaseView | null;
  startDate: string | null;
  /**
   * `current` is the earliest phase with work left (see `findCurrentPhase`). One before it is
   * `done` once the learner finished its work, and `unfinished` while some of it was set aside
   * (missed days the plan couldn't fit back): apps never mark it done, and say the lessons studied
   * of its total instead. `leftOut`: the plan holds none of its work, as a date too near for its
   * topics leaves it (`SyllabusSubject.notPlannedReason` `time`): never done, never ahead, and not
   * counted among the phases to finish.
   */
  state: "current" | "done" | "leftOut" | "unfinished" | "upcoming";
};

export type PlanDayView = {
  date: string;
  items: PlanItemView[];
  minutes: number;
  /** Why this day is lighter; null on unrelated days and the mock's own day. */
  mockFunding: MockFundingView | null;
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

/**
 * One of the plan's bases (see `findPlanBases`): a skill the goal's topics or final work build on,
 * worth less to the goal than what builds on it, which the learner chooses how to study (see
 * `BaseChoice`). `minutes` is what each way takes at their pace: every lesson (`deep`), its core
 * (`essential`, the first third of its lessons) and its quick lesson (`quick`); `neededFor` what's
 * built on it and worth more (an exam's notice topics, or a goal's outcome skills), the most
 * valuable first.
 */
export type PlanBaseView = {
  area: string;
  choice: BaseChoice;
  minutes: { deep: number; essential: number; quick: number };
  name: string;
  neededFor: string[];
  skillId: string;
};

/**
 * The plan's bases as the learner chooses how to study them. What the app recommends plans every
 * base in depth, so the learner asks for it (see `PlanBasesAdvice`). `knownCount` bases placement
 * or a test-out found the learner knows are out of the plan already.
 */
export type PlanBasesView = { daysLeft: number | null; items: PlanBaseView[]; knownCount: number };

/**
 * When an exam plan's mock exams still to take fall, from their scheduled days: how many, the next
 * one's day, and only the pattern the days keep: all on one weekday (`weekday`, Sunday 0, null
 * when they aren't or there's one), each a fixed number of weeks after the last (`everyWeeks`,
 * null when the gaps differ or there's one). Mocks go on the week's last study day, every week or
 * every few when a mock is longer than a study day, with a phase's own mock where none falls.
 */
export type MockScheduleView = {
  count: number;
  everyWeeks: number | null;
  nextDate: string;
  weekday: number | null;
};

/** The plan at three zoom levels (until the goal, this week, and the changes). */
export type PlanView = {
  access: {
    freeUntil: string | null;
    /** A free exam plan past its first week: new lessons, practice and mocks come with Plus. */
    freeWeekOver: boolean;
    mocksRequirePlus: boolean;
  };
  areas: {
    /** The part of the area in focus, as the learner named it; null when it's focused whole. */
    focusPart: string | null;
    focused: boolean;
    name: string;
    /**
     * The area it's part of, for an option the exam counts inside another subject (the foreign
     * language a candidate takes, inside ENEM's languages area): shown and focused with that area,
     * never on its own. Null for every other area.
     */
    partOf: string | null;
    /** The learner said they're past its basics: it starts past its foundations. */
    pastBasics: boolean;
    /** The learner wants less of it: it keeps its core, and its depth goes to other areas first. */
    reduced: boolean;
    skillCount: number;
    skipped: boolean;
  }[];
  /** The plan's bases to choose how to study; null when it has none. */
  bases: PlanBasesView | null;
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
  /** Actual remaining schedule numbers; null until a computed plan is available. */
  numbers: PlanNumbers | null;
  /**
   * The exam's choices (ENEM's foreign language: English or Spanish), each with its options and
   * the one the learner takes, which they can change from the plan. Empty without choices.
   */
  examChoices: ExamChoiceView[];
  /** What the exam's official documents are, for the plan's words (see `ExamDocument`). */
  examDocument: ExamDocument;
  /**
   * What the learner's own time covers by the goal's date, read from their plan: exact, and nothing
   * about other daily times or dates, which the learner asks for (see `findPlanTimeToCover`).
   */
  feasibility: {
    /** Every topic (every skill's core) is in the plan; false only when even the cores don't fit. */
    coreFits: boolean;
    /** The share of everything, in depth, the plan covers (see `measure`). */
    coveredShare: number;
    deadline: string | null;
    /** The topics the exam asks most keep more of their depth than the others. */
    deepensMostAsked: boolean;
    fits: boolean;
    /** A share of the exam's questions and points, or of the goal's skills by their weight. */
    measure: "exam" | "goal";
    /**
     * The learner's own daily time covers everything once the plan is planned again at it (see
     * `PlanFeasibility.timeCovers`): what the plan leaves out comes at their time (`fitOffer`).
     */
    timeCovers: boolean;
  } | null;
  /**
   * Every lesson of the plan is studied or tested out (see `isPlanFinished`): time for what to
   * study next. Null while something is left, set aside lessons included.
   */
  end: PlanEndView | null;
  goalId: string;
  /**
   * An exam plan built before research read the exam's notice: `reading` while the reveal waits
   * for that reading, `usual` once the wait ended without it (the plan follows the exam's usual
   * structure, and the reading arrives as a change to apply). Null otherwise.
   */
  notice: "reading" | "usual" | null;
  /** The level the learner gave (nothing yet to advanced), which they can change from the plan. */
  ownLevel: OwnLevel | null;
  /**
   * The lessons the learner's own time fits by the plan's date that the plan doesn't hold, as one
   * change (`fitLessons`, see `loadFitOffer`): once every lesson is done, or once their time covers
   * everything the plan leaves out. Null otherwise, and when it would add no lesson.
   */
  fitOffer: PlanOffer | null;
  /** Future todo mocks whose saved funding has started, with real item IDs and durations. */
  fundedMocks: (PlanItemView & { id: string })[];
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
    /**
     * The exam plan studies everything: what doesn't fit before the exam goes on after it (see
     * `PlanSettings.fullCourse`). False for other goals, which study everything without a date.
     */
    fullCourse: boolean;
    lightWeeks: LightWeek[];
    /** The mock exams still to take (see `MockScheduleView`); null without one ahead. */
    mocks: MockScheduleView | null;
    studyDays: number;
    /** The exam day the notice gives when it isn't `targetDate`; null otherwise. */
    noticeDay: NoticeDay | null;
    /** The learner's month has no sitting of their exam (see `NoSitting`); null otherwise. */
    noSitting: NoSitting | null;
    /**
     * For a plan that goes on after its exam (`fullCourse`), whose mocks there are for the exam's
     * next sitting: that sitting's first day, when the notice lists it; null otherwise.
     */
    nextSitting: string | null;
    targetDate: string | null;
    /** The date is the likely day of an edition whose notice isn't out yet. */
    targetDateEstimated: boolean;
    /**
     * The date is the start of the month the learner named ("in December"), which stands for that
     * month: screens say the month, not a day in it.
     */
    targetDateNamedMonth: boolean;
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
