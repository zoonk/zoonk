import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { type MaterialQuestionAnswer } from "@zoonk/core/library/sources/material-question-contract";
import { type LessonVisual } from "@zoonk/core/library/steps/contract";
import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
  type PlanTimeToCoverInput,
} from "@zoonk/core/plans/time-advice-contract";
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

export type StartUnderstandingOutcome =
  | { draft: OnboardingDraftView; status: "started" }
  | { draft: OnboardingDraftView; status: "startFailed" }
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier }
  | { status: "needsAccount" }
  | { status: "signUpRequired" }
  | { status: "failed" };

export type UnderstandingActions = {
  get: (draftId: string) => Promise<OnboardingDraftView | null>;
  retry: (draftId: string) => Promise<StartUnderstandingOutcome>;
  /** Null when it couldn't be saved. */
  revise: (input: {
    draftId: string;
    edit: OnboardingDraftEdit;
  }) => Promise<OnboardingDraftView | null>;
  start: (input: { goal: string; language: string }) => Promise<StartUnderstandingOutcome>;
};

export type GoalLimitReason =
  | "dailyExplanations"
  | "dailyGoals"
  | "guest"
  | "monthlyExplanations"
  | "monthlyGoals"
  | "oneActiveGoal"
  | "signUpRequired"
  | "slowDown";

export type CreateGoalsOutcome =
  | {
      /** Null when nothing started: the start failed, or the goal was already the learner's. */
      generationId: string | null;
      goalId: string;
      status: "created";
    }
  | { status: "failed" }
  | { reason: GoalLimitReason; status: "limitReached" };

export type AnswerOutcome = { onboarding: OnboardingView; status: "saved" } | { status: "failed" };

export type WaitlistOutcome = "failed" | "joined" | "signInRequired";

export type AttachedSource = { id: string; title: string };

export type UsageCap = { period: "day" | "month" | "total"; tier: EntitlementTier };

export type AttachOutcome =
  | { source: AttachedSource; status: "attached" }
  | ({ status: "limitReached" } & UsageCap)
  | { status: "failed" | "signInRequired" | "slowDown" | "unsupported" };

export type GoalAttachActions = {
  file: (input: { file: File; language: string }) => Promise<AttachOutcome>;
  link: (input: { language: string; url: string }) => Promise<AttachOutcome>;
  text: (input: { language: string; text: string }) => Promise<AttachOutcome>;
};

export type MaterialQuestionOutcome =
  | { answer: MaterialQuestionAnswer; status: "answered" }
  | ({ status: "limitReached" } & UsageCap)
  | { status: "failed" | "signInRequired" | "slowDown" };

/** Never says which answer is right. */
export type PlacementQuestion = {
  context: string | null;
  format: "multipleChoice" | "trueFalse" | "typed";
  image: ItemPictureData | null;
  itemId: string;
  options: string[] | null;
  question: string;
  skillId: string;
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
      /** 0 to 1. */
      dayBudgetSpent: number;
      dayBudgetUsed: boolean;
      isCorrect: boolean | null;
      next: PlacementQuestion | null;
      started: boolean;
      status: "ready";
      trueFalseLabels: TrueFalseLabels;
    }
  | { status: "failed" }
  | { status: "notReady" }
  | { status: "unavailable" }
  | { status: "generationFailed" };

export type PlacementMockOutcome = {
  mock: { id: string; status: "finished" | "running" } | null;
  offer: { access: "open" | "plusRequired"; minutes: { longest: number; shortest: number } } | null;
};

export type RevealedPlan = { plan: PlanView; syllabus: SyllabusView | null };

export type PlanOutcome = (RevealedPlan & { status: "ready" }) | { status: "failed" };

export type OnboardingActions = {
  answer: (input: { goalId: string; input: OnboardingAnswerInput }) => Promise<AnswerOutcome>;
  attach: GoalAttachActions;
  createGoals: (input: GoalCreateInput) => Promise<CreateGoalsOutcome>;
  finishPlacement: (input: { fromScratch: boolean; goalId: string }) => Promise<boolean>;
  getPlacement: (goalId: string) => Promise<PlacementOutcome>;
  getPlacementMock: (goalId: string) => Promise<PlacementMockOutcome>;
  getPlan: (goalId: string) => Promise<PlanOutcome>;
  /** `studyDays` count Sunday as 0. Null when it couldn't be read. */
  getTimeAdvice: (
    input: PlanTimeAdviceInput & { goalId: string; studyDays: number[] },
  ) => Promise<PlanTimeAdvice | null>;
  /** Null when it couldn't be found. */
  findTimeToCover: (
    input: PlanTimeToCoverInput & { goalId: string; studyDays: number[] },
  ) => Promise<PlanTimeToCover | null>;
  joinWaitlist: (input: { instrument: string; language: string }) => Promise<WaitlistOutcome>;
  answerPlacement: (input: {
    answer: PlacementAnswer;
    durationMs: number;
    goalId: string;
    itemId: string;
  }) => Promise<PlacementOutcome>;
  languageLevelTest: (goalId: string) => LanguageLevelTestActions;
  askMaterial: (input: {
    language: string;
    question: string;
    sourceIds: string[];
  }) => Promise<MaterialQuestionOutcome>;
  recordPlanWait: (milliseconds: number) => Promise<void>;
  startOver: (goalIds: string[]) => Promise<void>;
  stopPlacementMock: (mockId: string) => Promise<boolean>;
  understanding: UnderstandingActions;
};

export type OnboardingRoutes = {
  course: (course: { brandSlug: string; courseSlug: string }) => string;
  focusTest: (goalId: string) => string;
  mock: (mockId: string) => string;
  planLink: (planId: string) => string;
  placementMock: (goalId: string) => string;
  signUp: string;
  today: string;
};

export type OnboardingNavigation = {
  /** Replaces the page, so the archived goal's isn't kept in history. */
  replaceSteps: (goalId: string) => void;
  /** Only changes the address, not the screen, so a refresh shows the same draft; null when back to writing. */
  showDraft: (draftId: string | null) => void;
  toExplanation: (goalId: string) => void;
  toStart: () => void;
  toSteps: (goalId: string) => void;
};
