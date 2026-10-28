"use client";

import { type MockAnswer, type MockAnswerInput } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { createContext, use } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type MomentCeremony } from "../session/moment-ceremony";
import { type DraftSaveStatus } from "./draft-save-queue";
import { type SectionMoves } from "./section-moves";

export type MockPlanOfferOutcome =
  | { lessonsSkipped: number; status: "applied" }
  | { reason: "alreadyIn" | "cantMove" | null; status: "unchanged" };

export type MockEssayGrading = { mock: MockView; status: "graded" | "limitReached" };

export type MockPlayOutcome = { played: number; status: "counted" | "usedUp" };

/** Each resolves to null when it didn't go through. */
export type MockActions = {
  adapt: (offer: MockPlanOffer) => Promise<MockPlanOfferOutcome | null>;
  answer: (input: MockAnswerInput) => Promise<boolean>;
  endBreak: () => Promise<MockView | null>;
  finish: () => Promise<MockView | null>;
  gradeEssays: () => Promise<MockEssayGrading | null>;
  play: (setId: string) => Promise<MockPlayOutcome | null>;
  /** A GET, for when the deadline may now be abandoned; never scores the mock. */
  refresh?: () => void;
  startSpeaking: () => Promise<MockView | null>;
  submit: (section: number) => Promise<MockView | null>;
};

export type MockEssayGradingStatus = "failed" | "grading" | "idle" | "limitReached";

export type MockPlanOffer = "focus" | "skip";

export type MockHrefs = {
  again: string;
  continue: string;
  exit: string;
  mistakes: string;
  speakingTask: (conversationId: string) => string;
};

export type MockStep = "endBreak" | "finish" | "startSpeaking" | "submit";

export type MockRunner = {
  answer: (answer: MockAnswer | null) => void;
  busy: MockStep | null;
  drafts: Record<string, MockDraft>;
  error: boolean;
  essayGrading: MockEssayGradingStatus;
  finish: () => Promise<void>;
  gradeEssays: () => Promise<void>;
  endBreak: () => Promise<void>;
  go: (position: number) => void;
  moves: SectionMoves;
  pending: boolean;
  /** Resolves false when the mock had no play left, which stops the recording; one the server couldn't count keeps going. */
  play: (setId: string) => Promise<boolean>;
  position: number;
  retrySaves: () => void;
  saveStatus: DraftSaveStatus;
  savesInFlight: () => Promise<unknown> | null;
  slow: boolean;
  startSpeaking: () => Promise<void>;
  submitSection: () => Promise<void>;
  timeOutQuestion: () => void;
  timeUp: boolean;
  toggleFlag: () => void;
  view: MockView;
  write: (answer: MockAnswer | null) => void;
};

type MockScreenValue = {
  actions: MockActions;
  ask?: React.ReactNode;
  buddy?: LearnBuddy | null;
  hrefs: MockHrefs;
  renderCeremony?: MomentCeremony;
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
