"use client";

import { type HelpLimit } from "../_components/help-limit-notice";
import { type GenerationRun } from "../generation/generation-run";

export type MockShortStatus = {
  /** When the cap over the last 30 days gives back its next question-writing use. */
  availableAt: string | null;
  examQuestions: number;
  kind: "short";
  limit: "day" | "rolling30Days" | "total" | null;
  minutes: number;
  optionKey: string;
  questions: number;
};

export type MockChooserStatus =
  | { kind: "choosing" }
  /** `written`: the run writes the written test's questions, one model call with no steps to show. */
  | { kind: "writing"; run: GenerationRun; written?: boolean }
  | MockShortStatus
  | { kind: "failed"; reason: "failed" | "notEnoughQuestions" }
  | { kind: "refused"; limit: HelpLimit }
  /** Today's extra writing is used, so a mock with the written test waits for that day. */
  | { kind: "writingUsedUp"; returnsOn: string }
  /** The written test's questions depend on an exam choice the learner hasn't made yet. */
  | { choiceGroups: string[]; kind: "needsChoice" };
