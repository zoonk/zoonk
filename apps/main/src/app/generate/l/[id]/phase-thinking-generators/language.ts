"use client";

import { type PhaseName } from "@/lib/generation/lesson-generation-phase-config";
import { type ThinkingMessageGenerator, cycleMessage } from "@/lib/workflow/use-thinking-messages";
import { useExtracted } from "next-intl";

/** Returns thinking messages for language enrichment, romanization, and audio phases. */
export function useLanguagePhaseGenerators(): Partial<Record<PhaseName, ThinkingMessageGenerator>> {
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
