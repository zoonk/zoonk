"use client";

import { type ExamResultInput } from "@zoonk/core/exams/results/contract";
import { type ExamView } from "@zoonk/core/exams/view/contract";
import { createContext, use } from "react";
import { type ExamTaskStart } from "../language/exam-speaking/speaking-paper-section";

/** How the exam screen acts, supplied by the host. */
export type ExamActions = {
  /** "How did it go?": saves the official result; resolves to whether it was saved. */
  report: (input: ExamResultInput) => Promise<boolean>;
  /** Moves the goal's date to this day (the notice's), re-planning; resolves to whether it did. */
  setDate: (isoDate: string) => Promise<boolean>;
  /**
   * DELE, DELF, Goethe and Cambridge: starts a task of the exam's speaking paper with a new card and
   * opens its call; resolves to whether it started.
   */
  startExamTask: (task: string) => Promise<ExamTaskStart>;
  /** IELTS and TOEFL: starts the speaking mock call and opens it; resolves to whether it started. */
  startSpeakingMock: () => Promise<boolean>;
};

/**
 * Where the screen links: back to the Plan, a scheduled mock's intro (its plan item's
 * challenge), a finished speaking task's result and a finished mock's result (by the id it opens
 * by).
 */
export type ExamHrefs = {
  back: string;
  challenge: (planItemId: string) => string;
  /** A finished speaking task's result (by its call's id). */
  examTask: (conversationId: string) => string;
  mock: (blockId: string) => string;
};

type ExamScreenValue = {
  actions: ExamActions;
  exam: ExamView;
  hrefs: ExamHrefs;
  /** The speaking task a link asked to open (a result's "Next"), by its key. */
  openSpeakingTask: string | null;
};

const ExamScreenContext = createContext<ExamScreenValue | null>(null);

export function ExamScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ExamScreenValue;
}) {
  return <ExamScreenContext value={value}>{children}</ExamScreenContext>;
}

export function useExamScreen(): ExamScreenValue {
  const value = use(ExamScreenContext);

  if (!value) {
    throw new Error("Exam screen parts must be used within ExamScreen");
  }

  return value;
}
