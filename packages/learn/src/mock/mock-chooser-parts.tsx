"use client";

import { useExtracted } from "next-intl";
import { type HelpLimit } from "../_components/help-limit-notice";
import { PlusNotice } from "../_components/plus-lock";
import { type GenerationRun } from "../generation/generation-run";

type MockShortStatus = {
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

export function MockPlusNotice({ placement = false }: { placement?: boolean }) {
  const t = useExtracted();

  return (
    <PlusNotice cta={false}>
      {placement
        ? t("Mock exams come with Plus. Without it, the quick questions find your starting point.")
        : t("Mock exams come with Plus: whenever you want, and every week in your plan.")}
    </PlusNotice>
  );
}
