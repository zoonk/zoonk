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
  | { kind: "writing"; run: GenerationRun }
  | MockShortStatus
  | { kind: "failed"; reason: "failed" | "notEnoughQuestions" }
  | { kind: "refused"; limit: HelpLimit };
