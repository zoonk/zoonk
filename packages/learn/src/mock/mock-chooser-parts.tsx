"use client";

import { useExtracted } from "next-intl";
import { type HelpLimit } from "../_components/help-limit-notice";
import { PlusNotice } from "../_components/plus-lock";
import { type GenerationRun } from "../generation/generation-run";

/**
 * The picked mock can ask only part of its questions now, and nothing more can be written for it:
 * how many of how many, in how long, and whether fair use for new ones renews the next day or
 * month (`limit`). Start then takes it as it is.
 */
type MockShortStatus = {
  examQuestions: number;
  kind: "short";
  limit: "day" | "month" | "total" | null;
  minutes: number;
  /** The option it's for: picking another one asks again. */
  optionKey: string;
  questions: number;
};

/**
 * Where the chooser stands: picking, the run writing the picked mock's questions, a mock that can
 * ask only part of its questions now, or why it couldn't start (a bank with too few questions even
 * after writing, AI help used up for now, or a request that failed).
 */
export type MockChooserStatus =
  | { kind: "choosing" }
  | { kind: "writing"; run: GenerationRun }
  | MockShortStatus
  | { kind: "failed"; reason: "failed" | "notEnoughQuestions" }
  | { kind: "refused"; limit: HelpLimit };

/**
 * Every mock exam comes with Plus: the options stay visible, so the learner sees what it gives,
 * with Plus's one notice under them; the screen's main action is "See Plus", so the notice has no
 * link of its own. In onboarding (`placement`), it says the quick questions set the starting point
 * without it.
 */
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
