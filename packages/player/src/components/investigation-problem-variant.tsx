"use client";

import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import { ContextText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";

type ProblemContent = Extract<InvestigationStepContent, { variant: "problem" }>;

/**
 * Renders the problem step of an investigation activity.
 * Read-only — shows the scenario. The learner reads
 * the case and taps "Investigate" to start.
 *
 * The answer is pre-set in `buildInitialAnswers` so the bottom
 * bar button is always enabled without needing a useEffect.
 */
export function InvestigationProblemVariant({ content }: { content: ProblemContent }) {
  const t = useExtracted();

  return (
    <InteractiveStepLayout>
      <SectionLabel>{t("The Case")}</SectionLabel>

      <ContextText>{content.scenario}</ContextText>
    </InteractiveStepLayout>
  );
}
