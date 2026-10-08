"use client";

import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { createContext, use } from "react";

/** How the writing screen reaches the server. */
export type EssayActions = {
  /** Finishes the writing block and goes on with the session; false when it didn't go through. */
  finish: () => Promise<boolean>;
  /** Grades a draft; null when it couldn't be graded, "limitReached" when today's grades ran out. */
  submit: (input: {
    durationMs: number;
    text: string;
  }) => Promise<EssayDraft | "limitReached" | null>;
};

/** Where the screen leads when the learner leaves. */
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
