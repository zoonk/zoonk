"use client";

import { type PhaseName } from "@/lib/generation/lesson-generation-phase-config";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { useExtracted } from "next-intl";

/** Returns thinking messages for lesson content, image, and lifecycle phases. */
export function useContentPhaseGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  const t = useExtracted();

  return {
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
          t("Generating the images..."),
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
    preparingImages: (index) =>
      cycleMessage(
        [
          t("Thinking about what to illustrate..."),
          t("Planning each image..."),
          t("Choosing the right scenes..."),
          t("Planning the illustrations..."),
        ],
        index,
      ),
    saving: (index) =>
      cycleMessage(
        [
          t("Saving your lesson..."),
          t("Wrapping things up..."),
          t("Almost done..."),
          t("Finishing up..."),
        ],
        index,
      ),
    savingPrerequisites: (index) =>
      cycleMessage(
        [
          t("Saving earlier lessons..."),
          t("Storing prerequisite content..."),
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
