import path from "node:path";
import { type TestCase } from "@/lib/types";
import { TEST_CASES as LANGUAGE_AUDIO_CASES } from "../language-audio/test-cases";

/** Clips made by scripts/generate-look-alike-clips.ts, one per test case id. */
export const LOOK_ALIKE_CLIPS_DIR = path.join(process.cwd(), "data", "look-alike");

export type LookAlikeClipInput = {
  clipId: string;
  language: string;
  word: string;
  /** How the word sounds in its language, in IPA. */
  ipa: string;
  /** How English reads the same spelling, in IPA. */
  englishIpa: string;
  /** The language the clip was voiced as: the word's own, or English for an English reading. */
  voicedAs: string;
};

export type LookAlikeClipExpected = { pronunciation: "english" | "native" };

/**
 * Every look-alike word of the language-audio eval, twice: voiced as English, which reads it the
 * English way, and voiced by the app with its IPA and its check, so labeled native. The English
 * readings are the sure labels; the native ones catch a check that starts failing right clips.
 */
export const TEST_CASES: TestCase<LookAlikeClipExpected, LookAlikeClipInput>[] =
  LANGUAGE_AUDIO_CASES.flatMap(({ id, userInput }) => {
    const { language, lookAlike, text } = userInput;

    if (!lookAlike) {
      return [];
    }

    const word = { englishIpa: lookAlike.english, ipa: lookAlike.native, language, word: text };

    return [
      {
        expected: { pronunciation: "native" },
        id: `${id}-native`,
        userInput: { ...word, clipId: `${id}-native`, voicedAs: language },
      },
      {
        expected: { pronunciation: "english" },
        id: `${id}-english`,
        userInput: { ...word, clipId: `${id}-english`, voicedAs: "en" },
      },
    ];
  });
