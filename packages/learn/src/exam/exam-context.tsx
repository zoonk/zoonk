"use client";

import { type ExamResultInput } from "@zoonk/core/exams/results/contract";
import { type ExamView } from "@zoonk/core/exams/view/contract";
import { createContext, use } from "react";
import { type ExamTaskStart } from "../language/exam-speaking/speaking-paper-section";

/** Each resolves to whether it went through. */
export type ExamActions = {
  report: (input: ExamResultInput) => Promise<boolean>;
  setDate: (isoDate: string) => Promise<boolean>;
  startExamTask: (task: string) => Promise<ExamTaskStart>;
  startSpeakingMock: () => Promise<boolean>;
};

export type ExamHrefs = {
  back: string;
  challenge: (planItemId: string) => string;
  examTask: (conversationId: string) => string;
  mock: (blockId: string) => string;
};

type ExamScreenValue = {
  actions: ExamActions;
  exam: ExamView;
  hrefs: ExamHrefs;
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
