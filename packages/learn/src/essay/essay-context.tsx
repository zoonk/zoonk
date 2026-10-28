"use client";

import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { createContext, use } from "react";

export type EssayActions = {
  /** False when it didn't go through. */
  finish: () => Promise<boolean>;
  /**
   * Null when it couldn't be graded. A draft sent again keeps its `attemptId`, so the server grades
   * it once.
   */
  submit: (input: {
    attemptId: string;
    durationMs: number;
    text: string;
  }) => Promise<EssayDraft | "limitReached" | null>;
};

export type EssayHrefs = { exit: string };

type EssayScreenValue = {
  actions: EssayActions;
  drafts: EssayDraft[];
  essay: EssayView;
  hrefs: EssayHrefs;
};

const EssayScreenContext = createContext<EssayScreenValue | null>(null);

export function EssayScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: EssayScreenValue;
}) {
  return <EssayScreenContext value={value}>{children}</EssayScreenContext>;
}

export function useEssayScreen(): EssayScreenValue {
  const value = use(EssayScreenContext);

  if (!value) {
    throw new Error("Essay parts must be used within EssayScreen");
  }

  return value;
}
