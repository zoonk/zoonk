"use client";

import { type ExamResultInput } from "@zoonk/core/exams/results/contract";
import { type ExamView } from "@zoonk/core/exams/view/contract";
import { createContext, use } from "react";

/** How the exam screen acts, supplied by the host. */
export type ExamActions = {
  /** "How did it go?": saves the official result; resolves to whether it was saved. */
  report: (input: ExamResultInput) => Promise<boolean>;
  /** IELTS and TOEFL: starts the speaking mock call and opens it; resolves to whether it started. */
  startSpeakingMock: () => Promise<boolean>;
};

/** Where the screen links: a finished mock's result, by its block id. */
export type ExamHrefs = { mock: (blockId: string) => string };

type ExamScreenValue = { actions: ExamActions; exam: ExamView; hrefs: ExamHrefs };

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
