"use client";

import { type PhaseName } from "@/lib/generation/activity-generation-phase-config";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { useExtracted } from "next-intl";

/** Thinking generators for language-related phases (vocabulary, romanization, audio). */
function useLanguagePhaseGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  const t = useExtracted();

  return {
    addingGrammarRomanization: (index) =>
      cycleMessage(
        [
          t("Adding romanization for grammar..."),
          t("Converting grammar text to Latin script..."),
          t("Making grammar content easier to read..."),
        ],
        index,
      ),
    addingPronunciation: (index) =>
      cycleMessage(
        [
          t("Looking up how each word sounds..."),
          t("Mapping out the pronunciation..."),
          t("Checking how to say each word..."),
          t("Finding the right sounds..."),
        ],
        index,
      ),
    addingRomanization: (index) =>
      cycleMessage(
        [
          t("Converting to Latin script..."),
          t("Adding reading aids..."),
          t("Making it easier to read..."),
          t("Writing out the sounds..."),
        ],
        index,
      ),
    addingVocabularyRomanization: (index) =>
      cycleMessage(
        [
          t("Adding romanization for vocabulary..."),
          t("Converting vocabulary to Latin script..."),
          t("Making vocabulary easier to read..."),
        ],
        index,
      ),
    addingWordPronunciation: (index) =>
      cycleMessage(
        [
          t("Adding pronunciation for each word..."),
          t("Noting how each word sounds..."),
          t("Detailing the word sounds..."),
          t("Recording pronunciation info..."),
        ],
        index,
      ),
    buildingWordList: (index) =>
      cycleMessage(
        [
          t("Picking the key vocabulary..."),
          t("Choosing words to practice..."),
          t("Finding the most useful words..."),
          t("Selecting important terms..."),
        ],
        index,
      ),
    lookingUpWords: (index) =>
      cycleMessage(
        [
          t("Translating individual words..."),
          t("Looking up each term..."),
          t("Finding word meanings..."),
          t("Building the vocabulary guide..."),
        ],
        index,
      ),
    recordingAudio: (index) =>
      cycleMessage(
        [
          t("Recording the audio..."),
          t("Getting the pronunciation right..."),
          t("Preparing the voice..."),
          t("Making it sound natural..."),
        ],
        index,
      ),
    recordingVocabularyAudio: (index) =>
      cycleMessage(
        [
          t("Recording vocabulary audio..."),
          t("Getting the sound for each word..."),
          t("Preparing vocabulary audio..."),
          t("Making words listenable..."),
        ],
        index,
      ),
    recordingWordAudio: (index) =>
      cycleMessage(
        [
          t("Recording pronunciation for each word..."),
          t("Getting the audio for each term..."),
          t("Preparing word-by-word audio..."),
          t("Making each word listenable..."),
        ],
        index,
      ),
  };
}

/** Thinking generators for content, visual, and lifecycle phases. */
function useContentPhaseGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  const t = useExtracted();

  return {
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

/**
 * Returns thinking message generators for each phase.
 *
 * Split into two sub-hooks (language + content) to stay under the
 * max-lines-per-function lint limit. Together they cover every PhaseName.
 */
export function usePhaseThinkingGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
  return { ...useLanguagePhaseGenerators(), ...useContentPhaseGenerators() };
}
