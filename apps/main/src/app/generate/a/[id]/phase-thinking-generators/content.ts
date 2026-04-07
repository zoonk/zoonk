"use client";

import { type PhaseName } from "@/lib/generation/activity-generation-phase-config";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { useExtracted } from "next-intl";

/** Thinking generators for content, visual, and lifecycle phases. */
export function useContentPhaseGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  const t = useExtracted();

  return {
    buildingScenario: (index) =>
      cycleMessage(
        [
          t("Creating your story..."),
          t("Setting the scene..."),
          t("Designing the choices..."),
          t("Adding consequences..."),
        ],
        index,
      ),
    creatingAnswerOptions: (index) =>
      cycleMessage(
        [
          t("Preparing options..."),
          t("Adding more options..."),
          t("Getting answer options ready..."),
          t("Preparing the word bank..."),
        ],
        index,
      ),
    creatingExercises: (index) =>
      cycleMessage(
        [
          t("Designing practice exercises..."),
          t("Creating examples to try..."),
          t("Writing fill-in-the-blanks..."),
          t("Building interactive tasks..."),
        ],
        index,
      ),
    creatingImages: (index) =>
      cycleMessage(
        [
          t("Drawing an illustration..."),
          t("Working on the visuals..."),
          t("Adding some color..."),
          t("Refining the details..."),
          t("Finishing the artwork..."),
        ],
        index,
      ),
    creatingSentences: (index) =>
      cycleMessage(
        [
          t("Writing example sentences..."),
          t("Creating reading passages..."),
          t("Putting words in context..."),
          t("Building natural sentences..."),
        ],
        index,
      ),
    creatingVisuals: (index) =>
      cycleMessage(
        [
          t("Drawing an illustration..."),
          t("Creating the visual..."),
          t("Working on the details..."),
          t("Building the graphic..."),
          t("Rendering the visual..."),
        ],
        index,
      ),
    gettingStarted: (index) =>
      cycleMessage(
        [
          t("Getting everything ready..."),
          t("Setting things up..."),
          t("Loading lesson data..."),
          t("Checking what we need..."),
        ],
        index,
      ),
    preparingVisuals: (index) =>
      cycleMessage(
        [
          t("Thinking about what to illustrate..."),
          t("Sketching out ideas..."),
          t("Choosing the right style..."),
          t("Planning the layout..."),
        ],
        index,
      ),
    saving: (index) =>
      cycleMessage(
        [
          t("Saving your activity..."),
          t("Wrapping things up..."),
          t("Almost done..."),
          t("Finishing up..."),
        ],
        index,
      ),
    savingPrerequisites: (index) =>
      cycleMessage(
        [
          t("Saving vocabulary and grammar..."),
          t("Storing earlier activities..."),
          t("Getting ready for the next step..."),
        ],
        index,
      ),
    writingContent: (index) =>
      cycleMessage(
        [
          t("Researching the topic..."),
          t("Writing the explanation..."),
          t("Making it clear..."),
          t("Putting together the lesson..."),
          t("Crafting the content..."),
        ],
        index,
      ),
    writingDebrief: (index) =>
      cycleMessage(
        [
          t("Preparing the wrap-up..."),
          t("Connecting choices to concepts..."),
          t("Crafting the outcomes..."),
          t("Writing the debrief..."),
        ],
        index,
      ),
    writingExplanation: (index) =>
      cycleMessage(
        [
          t("Writing the explanation first..."),
          t("Building the foundation..."),
          t("Preparing background context..."),
          t("Explaining the topic..."),
        ],
        index,
      ),
  };
}
