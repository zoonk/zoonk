"use client";

import {
  type MockAnswerInput,
  type MockChoice,
  type MockDraft,
  type MockView,
} from "@zoonk/core/exams/mocks/contract";
import { createContext, use } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";

/** How the screen reaches the server. Each step returns the mock as it now stands. */
export type MockActions = {
  answer: (input: MockAnswerInput) => Promise<boolean>;
  finish: () => Promise<MockView | null>;
  move: () => Promise<{ changeId: string | null; date: string } | null>;
  start: () => Promise<MockView | null>;
  submit: (section: number) => Promise<MockView | null>;
  undoMove: (changeId: string) => Promise<boolean>;
};

/** Where the screen leads: out, back to the day, and to practicing the mistakes. */
export type MockHrefs = { continue: string; exit: string; mistakes: string };

/** A step of the mock the learner waits on: starting it, handing a section in, or scoring it. */
export type MockStep = "finish" | "start" | "submit";

export type MockRunner = {
  answer: (choice: MockChoice | null) => void;
  /** The step on its way, so its button says what's happening. */
  busy: MockStep | null;
  drafts: Record<string, MockDraft>;
  error: boolean;
  finish: () => Promise<void>;
  go: (position: number) => void;
  moved: { changeId: string | null; date: string } | null;
  moveToMonday: () => Promise<void>;
  pending: boolean;
  position: number;
  /** The step on its way is taking longer than usual. */
  slow: boolean;
  start: () => Promise<void>;
  submitSection: () => Promise<void>;
  toggleFlag: () => void;
  undoMove: () => Promise<void>;
  view: MockView;
};

type MockScreenValue = {
  /** The host's "Ask" about the finished mock; never shown while the mock runs. */
  ask?: React.ReactNode;
  hrefs: MockHrefs;
  buddy: LearnBuddy | null;
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
