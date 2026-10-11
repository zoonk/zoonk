"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { createContext, use } from "react";
import { type SectionMoves } from "./section-moves";

/**
 * What the learner's yes to one of the finished mock's offers did: applied (with the lessons a
 * skip took off), or nothing moved and, for a focus, why.
 */
export type MockPlanOfferOutcome =
  | { lessonsSkipped: number; status: "applied" }
  | { reason: "alreadyIn" | "cantMove" | null; status: "unchanged" };

/**
 * What grading a finished mock's essays came to: the mock with their grades, and whether the day's
 * essay grades ran out before every one was graded (`limitReached`).
 */
export type MockEssayGrading = { mock: MockView; status: "graded" | "limitReached" };

/**
 * What counting a recording's play came to: `counted` with the plays now used, or `usedUp` when
 * the mock had none left for it (another page used the last one).
 */
export type MockPlayOutcome = { played: number; status: "counted" | "usedUp" };

/** How the screen reaches the server. Each step returns the mock as it now stands. */
export type MockActions = {
  /** Applies one of the finished mock's offers (`MockAdaptView`); null when it didn't go through. */
  adapt: (offer: MockPlanOffer) => Promise<MockPlanOfferOutcome | null>;
  answer: (input: MockAnswerInput) => Promise<boolean>;
  /** Ends the break between two sections now; the mock as it stands. */
  endBreak: () => Promise<MockView | null>;
  finish: () => Promise<MockView | null>;
  /** Grades the finished mock's essays (a model call each); null when it didn't go through. */
  gradeEssays: () => Promise<MockEssayGrading | null>;
  /** Counts a play of a listening section's recording as it starts; null when it didn't go through. */
  play: (setId: string) => Promise<MockPlayOutcome | null>;
  /**
   * Starts the running speaking section: its paper's cards are written (or the ones already
   * written come back); the mock as it stands, with `speaking`.
   */
  startSpeaking: () => Promise<MockView | null>;
  submit: (section: number) => Promise<MockView | null>;
};

/**
 * Where grading the finished mock's essays stands on this screen: on its way (`grading`), failed,
 * held for another day (`limitReached`), or not running (`idle`).
 */
export type MockEssayGradingStatus = "failed" | "grading" | "idle" | "limitReached";

export type MockPlanOffer = "focus" | "skip";

/**
 * Where the screen leads: out, back to the day, to practicing the mistakes, and to a speaking
 * task's live call, which comes back to the mock.
 */
export type MockHrefs = {
  continue: string;
  exit: string;
  mistakes: string;
  speakingTask: (conversationId: string) => string;
};

/** A step of the mock the learner waits on: handing a section in, or scoring it. */
export type MockStep = "endBreak" | "finish" | "startSpeaking" | "submit";

export type MockRunner = {
  /** Saves the current question's pick (or picks), or a blank, at once. */
  answer: (answer: MockAnswer | null) => void;
  /** The step on its way, so its button says what's happening. */
  busy: MockStep | null;
  drafts: Record<string, MockDraft>;
  error: boolean;
  /** Where grading the finished mock's essays stands. */
  essayGrading: MockEssayGradingStatus;
  finish: () => Promise<void>;
  /** Grades the finished mock's essays: right after hand-in, or again from the result. */
  gradeEssays: () => Promise<void>;
  /** Starts the next section now, or once the break ran out, shows it. */
  endBreak: () => Promise<void>;
  go: (position: number) => void;
  /** How the running section lets the learner move, as the notice says (see `SectionMoves`). */
  moves: SectionMoves;
  pending: boolean;
  /**
   * Counts a recording's play on the mock as it starts: false when the mock had none left for it,
   * so the recording stops. A play the server couldn't count keeps going.
   */
  play: (setId: string) => Promise<boolean>;
  position: number;
  /** The answers still being saved, which leaving waits for so none is lost; null when none is. */
  savesInFlight: () => Promise<void> | null;
  /** The step on its way is taking longer than usual. */
  slow: boolean;
  /** Starts the running speaking section's paper (see `MockActions.startSpeaking`). */
  startSpeaking: () => Promise<void>;
  submitSection: () => Promise<void>;
  toggleFlag: () => void;
  view: MockView;
  /**
   * Keeps what the learner types for the current question (an essay's text, a word, a number),
   * saved a moment after they stop typing.
   */
  write: (answer: MockAnswer | null) => void;
};

type MockScreenValue = {
  actions: MockActions;
  /** The host's "Ask" about the finished mock; never shown while the mock runs. */
  ask?: React.ReactNode;
  hrefs: MockHrefs;
  runner: MockRunner;
};

const MockContext = createContext<MockScreenValue | null>(null);

export function MockProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: MockScreenValue;
}) {
  return <MockContext value={value}>{children}</MockContext>;
}

export function useMockScreen(): MockScreenValue {
  const value = use(MockContext);

  if (!value) {
    throw new Error("Mock parts must be used within a MockScreen");
  }

  return value;
}
