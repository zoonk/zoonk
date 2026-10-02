import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { type MaterialQuestionAnswer } from "@zoonk/core/library/sources/material-question-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import {
  type OnboardingAnswerInput,
  type OnboardingDraftEdit,
  type OnboardingDraftView,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { type LanguageLevelTestActions } from "../language/level-test/level-test-step";

/**
 * A typed goal saved as a draft and being read: `started` when its run is going (follow
 * `draft.generationId`) or it was already understood, `startFailed` when the draft was saved but
 * its run couldn't start (offer retry), `slowDown` after too many goals, `failed` otherwise.
 */
export type StartUnderstandingOutcome =
  | { draft: OnboardingDraftView; status: "started" }
  | { draft: OnboardingDraftView; status: "startFailed" }
  | { retryAfterSeconds: number; status: "slowDown" }
  /** Today's small AI calls are used up: a guest is asked to sign up, an account to come back. */
  | { status: "limitReached"; tier: EntitlementTier }
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
 * plan allows per day, or too many requests at once.
 */
export type GoalLimitReason = "dailyGoals" | "guest" | "oneActiveGoal" | "slowDown";

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

export type AttachOutcome =
  | { source: AttachedSource; status: "attached" }
  | { status: "failed" | "limitReached" | "signInRequired" | "unsupported" };

/** The paperclip: a file uploaded, or text or a link pasted, through the uploads API. */
export type GoalAttachActions = {
  file: (input: { file: File; language: string }) => Promise<AttachOutcome>;
  link: (input: { language: string; url: string }) => Promise<AttachOutcome>;
  text: (input: { language: string; text: string }) => Promise<AttachOutcome>;
};

/** An answer about the learner's own material, or why there's none. */
export type MaterialQuestionOutcome =
  | { answer: MaterialQuestionAnswer; status: "answered" }
  | { status: "failed" | "limitReached" | "signInRequired" };

/**
 * One placement question, as the learner sees it: never which answer is right. A `typed` one is
 * answered in the learner's own words and graded one key point at a time.
 */
export type PlacementQuestion = {
  context: string | null;
  format: "multipleChoice" | "trueFalse" | "typed";
  itemId: string;
  options: string[] | null;
  question: string;
  skillId: string;
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

export type PlanOutcome = { plan: PlanView; status: "ready" } | { status: "failed" };

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
  getPlan: (goalId: string) => Promise<PlanOutcome>;
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
  understanding: UnderstandingActions;
};

/** Where onboarding's links go, in the host's routes. */
export type OnboardingRoutes = {
  /** A Library course's page. */
  course: (course: { brandSlug: string; courseSlug: string }) => string;
  explore: string;
  /** A plan's public link, the one "Share" copies. */
  planLink: (planId: string) => string;
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
