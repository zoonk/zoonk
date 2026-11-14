"use client";

import { type HelpLimit } from "../_components/help-limit-notice";
import { type GenerationRun } from "../generation/generation-run";

export type MockShortStatus = {
  examQuestions: number;
  kind: "short";
  limit: "day" | "month" | "total" | null;
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
