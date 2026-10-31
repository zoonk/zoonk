import path from "node:path";
import { type TestCase } from "@/lib/types";
import { TEST_CASES as LANGUAGE_AUDIO_CASES } from "../language-audio/test-cases";

export const LOOK_ALIKE_CLIPS_DIR = path.join(process.cwd(), "data", "look-alike");

export type LookAlikeClipInput = {
  clipId: string;
  language: string;
  word: string;
  ipa: string;
  englishIpa: string;
  voicedAs: string;
};

export type LookAlikeClipExpected = { pronunciation: "english" | "native" };

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
