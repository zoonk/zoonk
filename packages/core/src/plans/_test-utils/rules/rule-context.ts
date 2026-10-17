import { type GoalKind } from "@zoonk/db";
import { type TopicLevel } from "../../../library/exams/topic-frequency";
import { type PreparationComponents } from "../../../preparation/preparation-math";
import {
  type SyllabusSubject,
  type SyllabusTopic,
} from "../../../view-models/syllabus/syllabus-contract";
import { type PlanOperation } from "../../plan-contract";
import { type PlanChangeView, type PlanView } from "../../plan-view-contract";
import { type ExistingPlanItem } from "../../planner/plan-items";
import { type PlanGraph, type PlanPhase, type PlanSettings } from "../../planner/plan-state";
import { type PlanTimeToCover } from "../../time-advice-contract";

/**
 * A plan item as a check reads it: the planner's own fields, so a planning run's items
 * (`BuiltPlan.items`) and saved rows both fit. `lessons` is a stand-in's size as saved (see
 * `countItemLessons`); without it a stand-in counts as one lesson. `minutes` is what a planning
 * run gave it, when the step has it.
 */
export type RuleItem = Pick<
  ExistingPlanItem,
  | "chapterId"
  | "completedAt"
  | "kind"
  | "lessonId"
  | "lessons"
  | "phase"
  | "scheduledFor"
  | "skillId"
  | "status"
  | "titleSnapshot"
> & { minutes?: number };

/**
 * A plan at one moment, as saved: what the planner read to make it and the items it laid out, in
 * the plan's order. Dates are learner-local days at UTC midnight, as the planner uses them.
 */
export type RulePlan = {
  goal: { dailyMinutes: number; kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly RuleItem[];
  phases: readonly PlanPhase[];
  /** Each skill's hard prerequisites, as the planner read them. */
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  settings: PlanSettings;
  /**
   * The skills each lesson teaches, by lesson id (the Library's lesson links): a finished lesson
   * counted for one skill began every skill it teaches.
   */
  taughtBy?: ReadonlyMap<string, readonly string[]>;
  /** How often the exam asks its notice's topics, for an exam with that data. */
  topicLevels?: readonly TopicLevel[];
};

/**
 * One answer the learner gave. True/false items say less than others (a guess is right half the
 * time), so they need more right answers to count a skill as known.
 */
export type RuleAnswer = {
  at: Date;
  correct: boolean;
  format: "other" | "trueFalse";
  /** A question of a recording (a listening set), the only kind a listening skill is asked. */
  recording?: boolean;
  skillId: string;
  source: "lesson" | "mock" | "placement" | "practice" | "review" | "testOut";
};

/**
 * What happened in a step. `learnerChange` is a learner's action (they made or applied a change);
 * `undo` takes back an applied change (an edit, or a test-out's skipped lessons), and `restores`
 * is the plan right before that change: pass it only when nothing but lessons the learner finished
 * happened in between. `placement`, `session`, `testOut` and `newDay` are progress (a missed day
 * counts: it moves dates); `outlinesLanded` and `refresh` are the system's own runs, which may not
 * change what the learner sees on their own. `accountDeleted` and `promptChanged` are for the
 * content rules. `answers` are the ones given in the step itself.
 */
export type RuleEvent =
  | { kind: "accountDeleted" }
  | { kind: "examPassed" }
  | {
      kind: "learnerChange";
      operations: readonly PlanOperation[];
      /**
       * The editor took the change as the Undo of the learner's latest edit: it set back by hand
       * what that edit changed (`undoSetBack`), so the plan goes back as it was before that edit.
       */
      setBack?: boolean;
    }
  /** A new day settled what earlier days left: `studied` when the last study day had progress. */
  | { kind: "newDay"; studied: boolean }
  /**
   * Research read a new edition of the exam's notice: `changesPlan` when following it would change
   * the plan, so the learner is asked again even after declining an earlier edition's change.
   */
  | { changesPlan: boolean; kind: "noticeEdition" }
  | { kind: "outlinesLanded" }
  | { answers?: readonly RuleAnswer[]; kind: "placement" }
  | { kind: "planCreated" }
  | { kind: "promptChanged" }
  /**
   * The app opened again the same day. `progressed`: the learner finished something since the plan
   * was last planned (a partial session plans nothing), so this run is the first to adapt to it.
   */
  | { kind: "refresh"; progressed?: boolean }
  | { answers?: readonly RuleAnswer[]; kind: "session" }
  | { answers?: readonly RuleAnswer[]; kind: "testOut" }
  | { change: "edited" | "testedOut"; kind: "undo"; restores: RulePlan };

/** What the learner is or wrote, which only their own private content may carry. */
type RuleLearner = {
  /** Skills a class test's own material announces questions on. */
  announcedSkillIds?: readonly string[];
  /** Areas placement found gaps in, or the learner said they don't know yet. */
  gapAreas?: readonly string[];
  /** Areas the learner said they know (onboarding's known subjects). */
  knownAreas?: readonly string[];
  /**
   * Skills the learner showed they know, as the planner read them when it last built the plan
   * (`loadPlannerInputs`' `knownSkillIds`, the claim model's `listKnownSkills`). R11 judges a plan
   * by what it was built with: a skill a step's answers make known after that run counts from the
   * next build. A skill whose test-out the learner undid isn't known until a
   * later answer of its own.
   */
  knownSkillIds?: readonly string[];
  /** Skills the goal's exam practices only with recordings (`getListeningSkillIds`). */
  listeningSkillIds?: readonly string[];
  /**
   * Skills a measured level places the learner past (a language level test's bands below the
   * level): a test of their own, so they may be tested out without answers on them.
   */
  measuredSkillIds?: readonly string[];
  /** The goal as typed, their name, free-text answers, memory facts: never in shared prompts. */
  personalTexts?: readonly string[];
  plus?: boolean;
};

/** A change the learner made or applied, on the learner-local day they did. */
type RuleLearnerChange = { day: Date; operations: readonly PlanOperation[] };

/** A text the learner was shown. `quoted` text reproduces a source (a past question, a statute). */
type RuleText = { quoted?: boolean; source: string; text: string };

/** Shared Library rows at one moment: `table:id` to a version (its `updatedAt` or a hash). */
type SharedContentSnapshot = ReadonlyMap<string, string>;

/** An AI task the step started (the simulator's stand-ins record them), with what it was sent. */
type RuleGeneration = { input: string; shared: boolean; task: string };

/**
 * One step of a learner's life as the checks read it: the plan before and after it, what happened,
 * the changes it recorded and what the learner was shown. Every part but `after`, `event` and
 * `today` is optional: a check whose inputs are missing finds nothing.
 */
export type RuleContext = {
  after: RulePlan;
  /** Every answer the learner gave so far, oldest first. */
  answers?: readonly RuleAnswer[];
  before: RulePlan | null;
  /** Plan changes the step wrote or answered, as clients read them. */
  changes?: readonly PlanChangeView[];
  /**
   * Proposals the learner declined on this plan before the step, as clients read them; a notice
   * day the understanding card offered and the learner kept their date over counts as a declined
   * `setNoticeDate`.
   */
  declined?: readonly PlanChangeView[];
  event: RuleEvent;
  /** Every lesson the learner finished so far, oldest first: when it comes back to review (R42). */
  finishedLessons?: readonly RuleFinishedLesson[];
  /** AI tasks the step started. */
  generations?: readonly RuleGeneration[];
  learner?: RuleLearner;
  /**
   * Every change the learner made or applied on this plan so far, oldest first, with its day: when
   * they passed over basics by choice (R18).
   */
  learnerChanges?: readonly RuleLearnerChange[];
  /** The goal's preparation after the step, as clients read it. */
  preparation?: RulePreparation;
  /** Every study session so far, oldest first: the day and the skills its practice asked. */
  sessions?: readonly RuleSession[];
  /** Shared Library rows before and after the step (the database tier). */
  sharedContent?: { after: SharedContentSnapshot; before: SharedContentSnapshot };
  shown?: readonly RuleText[];
  /**
   * The daily time that covers everything, as Find answered it when the step asked for it ("Find
   * the time that covers everything": see `findPlanTimeToCover`); screens never show it unasked.
   */
  timeToCover?: Pick<PlanTimeToCover, "recommendedMinutes">;
  /** The goal's syllabus after the step, as clients read it. */
  syllabus?: RuleSyllabus;
  /** The learner-local day of the step, at UTC midnight. */
  today: Date;
  /** Today's session was built before the step, so the learner saw today's lessons. */
  todayShown?: boolean;
  /** The plan as clients read it after the step. */
  view?: RuleView;
  /** Proposals still waiting for the learner's answer after the step, as clients read them. */
  waiting?: readonly PlanChangeView[];
};

/** The parts of the plan view the checks read: a whole `PlanView` fits. */
export type RuleView = {
  feasibility: Pick<NonNullable<PlanView["feasibility"]>, "coreFits" | "fits"> | null;
  schedule: Pick<PlanView["schedule"], "dailyMinutes">;
};

/** The parts of the goal's syllabus the checks read: a whole `SyllabusView` fits. */
export type RuleSyllabus = {
  subjects: readonly (Pick<SyllabusSubject, "areas" | "name"> & {
    topics: readonly Pick<SyllabusTopic, "name" | "notPlannedReason" | "status">[];
  })[];
};

/**
 * One study day's session: the skills its practice asked (mixed practice, a review, a full
 * review), as the session builder planned them.
 */
type RuleSession = { day: Date; practiceSkillIds: readonly string[] };

/**
 * A lesson the learner finished: the day they did, the skills it trained (the plan's skill it
 * counts for and the lesson's own, where its answers land), and the day its end screen said it
 * comes back (`comesBackOn`), null when it said none.
 */
type RuleFinishedLesson = {
  comesBackOn: Date | null;
  day: Date;
  lessonId: string;
  skillIds: readonly string[];
};

/**
 * The parts of a goal's preparation the checks read (a whole `GoalPreparation` fits once the
 * finished mocks are added): the overall number, its coverage and test parts, the estimated score,
 * and every finished mock with its questions and whether it sat one subject only.
 */
type RulePreparation = {
  components: {
    coverage: Pick<PreparationComponents["coverage"], "studiedSkills" | "value">;
    mocks: Pick<PreparationComponents["mocks"], "taken">;
  };
  estimatedScore: { high: number; low: number } | null;
  mocks: readonly { endedAt: Date; questions: number; subjectOnly: boolean }[];
  value: number;
};

/** A rule a step broke: which one, and what the check saw. */
export type RuleViolation = { details?: Record<string, unknown>; message: string; rule: string };
