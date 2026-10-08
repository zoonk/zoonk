"use client";

import {
  type MockAnswerInput,
  type MockChoice,
  type MockDraft,
  type MockView,
} from "@zoonk/core/exams/mocks/contract";
import { createContext, use } from "react";

/**
 * What the learner's yes to one of the finished mock's offers did: applied (with the lessons a
 * skip took off), or nothing moved and, for a focus, why.
 */
export type MockPlanOfferOutcome =
  | { lessonsSkipped: number; status: "applied" }
  | { reason: "alreadyIn" | "cantMove" | null; status: "unchanged" };

/** How the screen reaches the server. Each step returns the mock as it now stands. */
export type MockActions = {
  /** Applies one of the finished mock's offers (`MockAdaptView`); null when it didn't go through. */
  adapt: (offer: MockPlanOffer) => Promise<MockPlanOfferOutcome | null>;
  answer: (input: MockAnswerInput) => Promise<boolean>;
  finish: () => Promise<MockView | null>;
  submit: (section: number) => Promise<MockView | null>;
};

export type MockPlanOffer = "focus" | "skip";

/** Where the screen leads: out, back to the day, and to practicing the mistakes. */
export type MockHrefs = { continue: string; exit: string; mistakes: string };

/** A step of the mock the learner waits on: handing a section in, or scoring it. */
export type MockStep = "finish" | "submit";

export type MockRunner = {
  answer: (choice: MockChoice | null) => void;
  /** The step on its way, so its button says what's happening. */
  busy: MockStep | null;
  drafts: Record<string, MockDraft>;
  error: boolean;
  finish: () => Promise<void>;
  go: (position: number) => void;
  pending: boolean;
  position: number;
  /** The step on its way is taking longer than usual. */
  slow: boolean;
  submitSection: () => Promise<void>;
  toggleFlag: () => void;
  view: MockView;
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
