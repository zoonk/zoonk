import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import { segmentWords, stripPunctuation } from "@zoonk/utils/string";
import {
  type SerializedStep,
  type SerializedWord,
  type WordBankOption,
} from "./prepare-activity-data";
import { type DistractorWord } from "./translation-options";

type WordDataInput = {
  audioUrl: string | null;
  romanization: string | null;
  word: string;
};

type WordMetadata = Omit<WordBankOption, "word">;

/**
 * Word-bank lookups should ignore punctuation and casing so the same visible token resolves
 * to one metadata entry regardless of where it came from.
 */
function normalizeWordKey(word: string): string {
  return stripPunctuation(word).toLowerCase().trim();
}

/**
 * Multi-word lesson entries can still supply metadata for their individual tokens. This
 * keeps canonical sentence chips hydrated even when the lesson stored a phrase as one word.
 */
function splitMultiWordEntries(lessonWord: SerializedWord): [string, WordMetadata][] {
  const wordTokens = lessonWord.word.split(" ").filter(Boolean);

  if (wordTokens.length <= 1) {
    return [];
  }

  const romanizationTokens = lessonWord.romanization?.split(" ").filter(Boolean) ?? [];
  const canSlice = romanizationTokens.length === wordTokens.length;

  return wordTokens.map((token, index) => [
    normalizeWordKey(token),
    {
      audioUrl: null,
      romanization: canSlice ? (romanizationTokens[index] ?? null) : null,
      translation: null,
    },
  ]);
}

/**
 * Canonical lesson words and hydrated distractor words share one metadata lookup. Sentence-
 * specific word metadata overrides both because it is the most precise source.
 */
function buildWordMetadataLookup(params: {
  distractorWords: DistractorWord[];
  lessonWords: SerializedWord[];
  sentenceWordMap: Map<string, WordDataInput>;
}): Map<string, WordMetadata> {
  const lessonEntries = params.lessonWords.flatMap((lessonWord) => [
    ...splitMultiWordEntries(lessonWord),
    [
      normalizeWordKey(lessonWord.word),
      {
        audioUrl: lessonWord.audioUrl,
        romanization: lessonWord.romanization,
        translation: lessonWord.translation,
      },
    ] as const,
  ]);

  const distractorEntries = params.distractorWords.map(
    (word) =>
      [
        normalizeWordKey(word.word),
        {
          audioUrl: word.audioUrl,
          romanization: word.romanization,
          translation: null,
        },
      ] as const,
  );

  const sentenceEntries = [...params.sentenceWordMap.values()].map(
    (word) =>
      [
        normalizeWordKey(word.word),
        {
          audioUrl: word.audioUrl,
          romanization: word.romanization,
          translation: null,
        },
      ] as const,
  );

  return new Map([...lessonEntries, ...distractorEntries, ...sentenceEntries]);
}

/**
 * Reading chips and word-bank tiles both need the same metadata lookup rule. Wrapping the
 * lookup keeps the exported builders focused on activity-level behavior instead of map code.
 */
function createWordOptionBuilder(params: {
  distractorWords: DistractorWord[];
  lessonWords: SerializedWord[];
  sentenceWordMap: Map<string, WordDataInput>;
}): (word: string) => WordBankOption {
  const metadataLookup = buildWordMetadataLookup(params);

  return (word) => {
    const metadata = metadataLookup.get(normalizeWordKey(word));

    return {
      audioUrl: metadata?.audioUrl ?? null,
      romanization: metadata?.romanization ?? null,
      translation: metadata?.translation ?? null,
      word,
    };
  };
}

/**
 * Listening word banks intentionally stay as plain strings because learner-language
 * distractors do not get target-language enrichment.
 */
function emptyWordOption(word: string): WordBankOption {
  return { audioUrl: null, romanization: null, translation: null, word };
}

/**
 * Sentence chips should use the same lookup path as reading word-bank options so the UI
 * never shows different romanization or audio metadata for the same token.
 */
export function buildSentenceWordOptions(
  sentence: string,
  lessonWords: SerializedWord[],
  distractorWords: DistractorWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption[] {
  const buildOption = createWordOptionBuilder({ distractorWords, lessonWords, sentenceWordMap });
  return segmentWords(sentence).map((word) => buildOption(word));
}

/**
 * Reading and listening both produce arrange-words banks. This small config object keeps
 * the public builder declarative and avoids branching logic during option construction.
 */
function getWordBankConfig(step: SerializedStep): {
  correctWords: string[];
  distractors: string[];
  usesTargetLanguageMetadata: boolean;
} | null {
  if (step.kind === "reading" && step.sentence) {
    return {
      correctWords: segmentWords(step.sentence.sentence),
      distractors: sanitizeDistractors({
        distractors: step.sentence.distractors,
        input: step.sentence.sentence,
        shape: "single-word",
      }),
      usesTargetLanguageMetadata: true,
    };
  }

  if (step.kind === "listening" && step.sentence) {
    return {
      correctWords: segmentWords(step.sentence.translation),
      distractors: sanitizeDistractors({
        distractors: step.sentence.translationDistractors,
        input: step.sentence.translation,
        shape: "single-word",
      }),
      usesTargetLanguageMetadata: false,
    };
  }

  return null;
}

/**
 * Distractors only need one deterministic runtime guard now: never show a token that is
 * already part of the canonical answer.
 */
function removeCanonicalWordCollisions(distractors: string[], correctWords: string[]): string[] {
  const canonicalWordKeys = new Set(correctWords.map((word) => normalizeWordKey(word)));

  return distractors.filter((word) => !canonicalWordKeys.has(normalizeWordKey(word)));
}

/**
 * Builds the final arrange-words option list from canonical tokens plus stored direct
 * distractors. There is no semantic filtering, fallback lesson lookup, or local top-up.
 */
export function buildWordBankOptions(
  step: SerializedStep,
  lessonWords: SerializedWord[],
  distractorWords: DistractorWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption[] {
  const config = getWordBankConfig(step);

  if (!config) {
    return [];
  }

  const buildOption = config.usesTargetLanguageMetadata
    ? createWordOptionBuilder({ distractorWords, lessonWords, sentenceWordMap })
    : emptyWordOption;
  const distractorWordsForBank = removeCanonicalWordCollisions(
    config.distractors,
    config.correctWords,
  );

  return shuffle([
    ...config.correctWords.map((word) => buildOption(word)),
    ...distractorWordsForBank.map((word) => buildOption(word)),
  ]);
}
