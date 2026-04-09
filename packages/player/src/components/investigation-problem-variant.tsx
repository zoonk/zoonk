"use client";

import { type InvestigationStepContent } from "@zoonk/core/steps/contract/content";
import { useExtracted } from "next-intl";
import {
  PlayerReadScene,
  PlayerReadSceneBody,
  PlayerReadSceneEyebrow,
  PlayerReadSceneStack,
} from "./player-read-scene";

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
    <PlayerReadScene>
      <PlayerReadSceneStack>
        <PlayerReadSceneEyebrow>{t("The Case")}</PlayerReadSceneEyebrow>
        <PlayerReadSceneBody>{content.scenario}</PlayerReadSceneBody>
      </PlayerReadSceneStack>

      <p className="text-muted-foreground text-sm">{t("Collect 2 leads. Then make your call.")}</p>
    </PlayerReadScene>
  );
}
