"use client";

import { type PhaseName } from "@/lib/generation/activity-generation-phase-config";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { useExtracted } from "next-intl";

/** Thinking generators for investigation-related phases. */
export function useInvestigationPhaseGenerators(): Partial<
  Record<PhaseName, ThinkingMessageGenerator>
> {
  const t = useExtracted();

  return {
    analyzingEvidence: (index) =>
      cycleMessage(
        [
          t("Writing interpretations for each finding..."),
          t("Crafting analysis statements..."),
          t("Building the reasoning chains..."),
          t("Examining evidence from every angle..."),
        ],
        index,
      ),
    classifyingExplanations: (index) =>
      cycleMessage(
        [
          t("Evaluating each explanation..."),
          t("Determining accuracy levels..."),
          t("Sorting explanations by quality..."),
        ],
        index,
      ),
    designingActions: (index) =>
      cycleMessage(
        [
          t("Planning investigation steps..."),
          t("Designing what you can investigate..."),
          t("Creating action options..."),
          t("Mapping out the investigation paths..."),
        ],
        index,
      ),
    gatheringEvidence: (index) =>
      cycleMessage(
        [
          t("Generating evidence for each action..."),
          t("Crafting the findings..."),
          t("Making the evidence deliberately ambiguous..."),
          t("Building the clues..."),
        ],
        index,
      ),
    settingTheScene: (index) =>
      cycleMessage(
        [
          t("Creating the mystery scenario..."),
          t("Setting up the investigation..."),
          t("Crafting possible explanations..."),
          t("Designing the case..."),
        ],
        index,
      ),
    writingTheReveal: (index) =>
      cycleMessage(
        [
          t("Writing the final explanation..."),
          t("Crafting the reveal moment..."),
          t("Preparing the debrief..."),
        ],
        index,
      ),
  };
}
