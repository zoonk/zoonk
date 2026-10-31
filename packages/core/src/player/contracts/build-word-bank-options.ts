import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import { segmentLearnerWords, segmentWords, stripPunctuation } from "@zoonk/utils/string";
import { getTileRomanization } from "./_utils/tile-romanization";
import {
  type SerializedStep,
  type SerializedWord,
  type WordBankOption,
} from "./prepare-lesson-data";
import { type DistractorWord } from "./translation-options";

type WordDataInput = {
  audioUrl: string | null;
  romanization: string | null;
  translation: string;
  word: string;
};

type WordMetadata = Omit<WordBankOption, "word">;

const WORD_BANK_DISTRACTOR_LIMIT = 4;

function normalizeWordKey(word: string): string {
  return stripPunctuation(word).toLowerCase().trim();
}

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

function mergeWordMetadata({
  current,
  incoming,
}: {
  current?: WordMetadata;
  incoming: WordMetadata;
}): WordMetadata {
  return {
    audioUrl: incoming.audioUrl ?? current?.audioUrl ?? null,
    romanization: incoming.romanization ?? current?.romanization ?? null,
    translation: current?.translation ?? incoming.translation ?? null,
  };
}

function getUniqueMetadataKeys(entries: readonly (readonly [string, WordMetadata])[]): string[] {
  return [...new Set(entries.map(([key]) => key))];
}

function getMergedWordMetadata(
  entries: readonly (readonly [string, WordMetadata])[],
  key: string,
): WordMetadata {
  return entries
    .filter(([entryKey]) => entryKey === key)
    .map(([, metadata]) => metadata)
    .reduce((current, incoming) => mergeWordMetadata({ current, incoming }));
}

function buildMergedWordMetadataLookup(
  entries: readonly (readonly [string, WordMetadata])[],
): Map<string, WordMetadata> {
  return new Map(
    getUniqueMetadataKeys(entries).map((key) => [key, getMergedWordMetadata(entries, key)]),
  );
}

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
        { audioUrl: word.audioUrl, romanization: word.romanization, translation: null },
      ] as const,
  );

  const sentenceEntries = [...params.sentenceWordMap.values()].map(
    (word) =>
      [
        normalizeWordKey(word.word),
        {
          audioUrl: word.audioUrl,
          romanization: word.romanization,
          translation: word.translation || null,
        },
      ] as const,
  );

  return buildMergedWordMetadataLookup([
    ...lessonEntries,
    ...distractorEntries,
    ...sentenceEntries,
  ]);
}

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
      romanization: getTileRomanization({ romanization: metadata?.romanization ?? null, word }),
      translation: metadata?.translation ?? null,
      word,
    };
  };
}

/** Listening distractors are learner-language strings and must not receive target-language enrichment. */
function emptyWordOption(word: string): WordBankOption {
  return { audioUrl: null, romanization: null, translation: null, word };
}

/** Uses the same token metadata precedence as reading banks. */
export function buildSentenceWordOptions(
  sentence: string,
  lessonWords: SerializedWord[],
  distractorWords: DistractorWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption[] {
  const buildOption = createWordOptionBuilder({ distractorWords, lessonWords, sentenceWordMap });
  return segmentWords(sentence).map((word) => buildOption(word));
}

export type LessonLanguages = { language: string; targetLanguage: string };

type WordBankConfig = {
  correctWords: string[];
  distractors: string[];
  language: string;
  usesTargetLanguageMetadata: boolean;
};

function getWordBankConfig(
  step: SerializedStep,
  languages: LessonLanguages,
): WordBankConfig | null {
  if (step.kind === "reading" && step.sentence) {
    return {
      correctWords: segmentWords(step.sentence.sentence),
      distractors: sanitizeDistractors({
        distractors: step.sentence.distractors,
        input: step.sentence.sentence,
        shape: "single-word",
      }),
      language: languages.targetLanguage,
      usesTargetLanguageMetadata: true,
    };
  }

  if (step.kind === "listening" && step.sentence) {
    return {
      correctWords: segmentLearnerWords(step.sentence.translation),
      distractors: sanitizeDistractors({
        distractors: step.sentence.translationDistractors,
        input: step.sentence.translation,
        shape: "single-learner-word",
      }),
      language: languages.language,
      usesTargetLanguageMetadata: false,
    };
  }

  return null;
}

function removeCanonicalWordCollisions({
  correctWords,
  distractors,
  language,
}: {
  correctWords: string[];
  distractors: string[];
  language: string;
}): string[] {
  const toKey = (word: string) => stripPunctuation(word).toLocaleLowerCase(language).trim();
  const canonicalWordKeys = new Set(correctWords.map((word) => toKey(word)));

  return distractors.filter((word) => !canonicalWordKeys.has(toKey(word)));
}

/** Normalize distractor casing so capitalization cannot reveal extra tiles. */
function getVisibleDistractors({
  distractors,
  language,
}: {
  distractors: string[];
  language: string;
}): string[] {
  return shuffle(distractors)
    .slice(0, WORD_BANK_DISTRACTOR_LIMIT)
    .map((distractor) => distractor.toLocaleLowerCase(language));
}

export function buildWordBankOptions(
  step: SerializedStep,
  lessonWords: SerializedWord[],
  distractorWords: DistractorWord[],
  sentenceWordMap: Map<string, WordDataInput>,
  languages: LessonLanguages,
): WordBankOption[] {
  const config = getWordBankConfig(step, languages);

  if (!config) {
    return [];
  }

  const distractors = getVisibleDistractors({
    distractors: removeCanonicalWordCollisions(config),
    language: config.language,
  });

  const words = shuffle([...config.correctWords, ...distractors]);

  const buildOption = config.usesTargetLanguageMetadata
    ? createWordOptionBuilder({ distractorWords, lessonWords, sentenceWordMap })
    : emptyWordOption;

  return words.map((word) => buildOption(word));
}
