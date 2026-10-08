import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { type MaterialQuestionAnswer } from "@zoonk/core/library/sources/material-question-contract";
import { type LessonVisual } from "@zoonk/core/library/steps/contract";
import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import {
  type OnboardingAnswerInput,
  type OnboardingDraftEdit,
  type OnboardingDraftView,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { type LanguageLevelTestActions } from "../language/level-test/level-test-step";
import { type ItemPictureData } from "../questions/item-picture";

/**
 * A typed goal saved as a draft and being read: `started` when its run is going (follow
 * `draft.generationId`) or it was already understood, `startFailed` when the draft was saved but
 * its run couldn't start (offer retry), `slowDown` after too many goals, `failed` otherwise.
 */
export type StartUnderstandingOutcome =
  | { draft: OnboardingDraftView; status: "started" }
  | { draft: OnboardingDraftView; status: "startFailed" }
  | { retryAfterSeconds: number; status: "slowDown" }
  /**
   * The small AI calls of the day or the month (`period`) are used up: a guest is asked to sign
   * up, an account to come back (or a free one to get Plus).
   */
  | { period: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier }
  /** A guest's one goal is taken: nothing is read, since only an account adds another. */
  | { status: "needsAccount" }
  | { status: "failed" };

/** Reading a typed goal in a workflow, kept as a draft a refresh shows again. */
export type UnderstandingActions = {
  get: (draftId: string) => Promise<OnboardingDraftView | null>;
  /** Starts reading the draft again after its run failed or couldn't start. */
  retry: (draftId: string) => Promise<StartUnderstandingOutcome>;
  /** One fix on the card; the fields that depend on it follow. Null when it couldn't be saved. */
  revise: (input: {
    draftId: string;
    edit: OnboardingDraftEdit;
  }) => Promise<OnboardingDraftView | null>;
  start: (input: { goal: string; language: string }) => Promise<StartUnderstandingOutcome>;
};

/**
 * Why a goal couldn't start: a guest's one goal, the free plan's one active goal, the new goals a
 * plan allows per day or (the free plan) per month, the quick explanations the free plan allows
 * per day or per month, or too many requests at once.
 */
export type GoalLimitReason =
  | "dailyExplanations"
  | "dailyGoals"
  | "guest"
  | "monthlyExplanations"
  | "monthlyGoals"
  | "oneActiveGoal"
  | "slowDown";

export type CreateGoalsOutcome =
  | {
      /**
       * Whether the goal's plan (or explanation) started being written. False when the start
       * failed: the goal exists, and its steps offer to start it again (the run follower's retry).
       */
      generationStarted: boolean;
      goalId: string;
      status: "created";
    }
  | { status: "failed" }
  | { reason: GoalLimitReason; status: "limitReached" };

export type AnswerOutcome =
  | { onboarding: OnboardingView; status: "saved" }
  | { status: "accountDeleted" }
  | { status: "failed" };

export type WaitlistOutcome = "failed" | "joined" | "signInRequired";

/** Material the learner attached to the goal they're typing, shown as a chip. */
export type AttachedSource = { id: string; title: string };

/** A plan's cap that refused a use, for the day or the month (a guest's has no account to lift it). */
export type UsageCap = { period: "day" | "month" | "total"; tier: EntitlementTier };

export type AttachOutcome =
  | { source: AttachedSource; status: "attached" }
  | ({ status: "limitReached" } & UsageCap)
  | { status: "failed" | "signInRequired" | "slowDown" | "unsupported" };

/** The paperclip: a file uploaded, or text or a link pasted, through the uploads API. */
export type GoalAttachActions = {
  file: (input: { file: File; language: string }) => Promise<AttachOutcome>;
  link: (input: { language: string; url: string }) => Promise<AttachOutcome>;
  text: (input: { language: string; text: string }) => Promise<AttachOutcome>;
};

/** An answer about the learner's own material, or why there's none. */
export type MaterialQuestionOutcome =
  | { answer: MaterialQuestionAnswer; status: "answered" }
  | ({ status: "limitReached" } & UsageCap)
  | { status: "failed" | "signInRequired" | "slowDown" };

/**
 * One placement question, as the learner sees it: never which answer is right. A `typed` one is
 * answered in the learner's own words and graded one key point at a time.
 */
export type PlacementQuestion = {
  context: string | null;
  format: "multipleChoice" | "trueFalse" | "typed";
  /** The figure the question is about, when it's about one. */
  image: ItemPictureData | null;
  itemId: string;
  options: string[] | null;
  question: string;
  skillId: string;
  /** A chart or timeline the question reads, drawn from its data. */
  visual: LessonVisual | null;
};

export type PlacementAnswer =
  | { dontKnow: true }
  | { isTrue: boolean }
  | { selectedIndex: number }
  | { text: string };

export type PlacementOutcome =
  | {
      answered: number;
      complete: boolean;
      /** Today's few minutes of placement are used; the first week's sessions ask the rest. */
      dayBudgetUsed: boolean;
      /** Whether the answer just sent was right; null when nothing was answered. */
      isCorrect: boolean | null;
      next: PlacementQuestion | null;
      /** This goal's placement already has answers, so coming back resumes it. */
      started: boolean;
      status: "ready";
      /** The words the goal's true-or-false questions are answered with, by its exam. */
      trueFalseLabels: TrueFalseLabels;
    }
  | { status: "failed" }
  | { status: "notReady" }
  /**
   * No placement question could be written for this goal and none was answered: go on without
   * placement (`finishPlacement`); the first week's sessions and lessons place the learner.
   */
  | { status: "unavailable" }
  /** The goal's plan couldn't be built: offer to start it again (the run follower's retry). */
  | { status: "generationFailed" };

/**
 * A diagnostic mock in the exam's format, offered in placement instead of the quick questions:
 * how long its lengths take, from the shortest to the longest, and whether the learner's plan
 * includes it (Plus) (null when the exam has none), and the goal's own once started.
 */
export type PlacementMockOutcome = {
  mock: { id: string; status: "finished" | "running" } | null;
  offer: { access: "open" | "plusRequired"; minutes: { longest: number; shortest: number } } | null;
};

/** A plan ready to reveal, with the goal's structure (its notice's subjects, or its modules). */
export type RevealedPlan = { plan: PlanView; syllabus: SyllabusView | null };

export type PlanOutcome = (RevealedPlan & { status: "ready" }) | { status: "failed" };

/**
 * How onboarding reaches the server. The host implements these over its own actions (the web
 * app) or the public API (a native app), so the screens never know about auth or URLs.
 */
export type OnboardingActions = {
  answer: (input: { goalId: string; input: OnboardingAnswerInput }) => Promise<AnswerOutcome>;
  /** The paperclip's uploads. */
  attach: GoalAttachActions;
  createGoals: (input: GoalCreateInput) => Promise<CreateGoalsOutcome>;
  finishPlacement: (input: { fromScratch: boolean; goalId: string }) => Promise<boolean>;
  getPlacement: (goalId: string) => Promise<PlacementOutcome>;
  /** The placement mock's offer and the goal's own, once started. */
  getPlacementMock: (goalId: string) => Promise<PlacementMockOutcome>;
  getPlan: (goalId: string) => Promise<PlanOutcome>;
  /**
   * The daily time the goal's plan needs on these study days (Sunday is 0), for the time
   * question; null when it couldn't be read.
   */
  getTimeAdvice: (input: { goalId: string; studyDays: number[] }) => Promise<PlanTimeAdvice | null>;
  inviteGuardian: (email: string) => Promise<boolean>;
  joinWaitlist: (input: { instrument: string; language: string }) => Promise<WaitlistOutcome>;
  answerPlacement: (input: {
    answer: PlacementAnswer;
    durationMs: number;
    goalId: string;
    itemId: string;
  }) => Promise<PlacementOutcome>;
  /** A language goal's level test. */
  languageLevelTest: (goalId: string) => LanguageLevelTestActions;
  /** Questions about the material attached with the paperclip. */
  askMaterial: (input: {
    language: string;
    question: string;
    sourceIds: string[];
  }) => Promise<MaterialQuestionOutcome>;
  /** Reports how long the learner watched the plan being written ("Generation Waited", curriculum). */
  recordPlanWait: (milliseconds: number) => Promise<void>;
  /** Archives the goals of an onboarding the learner starts over. */
  startOver: (goalIds: string[]) => Promise<void>;
  /** Ends a running placement mock now: what was answered sets where the plan starts. */
  stopPlacementMock: (mockId: string) => Promise<boolean>;
  understanding: UnderstandingActions;
};

/** Where onboarding's links go, in the host's routes. */
export type OnboardingRoutes = {
  /** A Library course's page. */
  course: (course: { brandSlug: string; courseSlug: string }) => string;
  explore: string;
  /** A goal's focus test, where answers choose where its plan's depth goes. */
  focusTest: (goalId: string) => string;
  /** A running mock, by its id. */
  mock: (mockId: string) => string;
  /** A plan's public link, the one "Share" copies. */
  planLink: (planId: string) => string;
  /** A diagnostic mock, instead of placement's quick questions. */
  placementMock: (goalId: string) => string;
  signUp: string;
  today: string;
};

/** Moves to another onboarding page through the host's router. */
export type OnboardingNavigation = {
  /**
   * The steps continue on another goal in place of this one, when an answer moved it (a language
   * goal for a certificate becomes an exam goal), so the archived goal's page isn't kept.
   */
  replaceSteps: (goalId: string) => void;
  /**
   * Keeps the typed goal being confirmed in the address, so a refresh shows the same screen; null
   * when the learner is back to writing a goal. It only changes the address, not the screen.
   */
  showDraft: (draftId: string | null) => void;
  toExplanation: (goalId: string) => void;
  toStart: () => void;
  toSteps: (goalId: string) => void;
};
