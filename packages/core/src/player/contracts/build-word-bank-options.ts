import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { shuffle } from "@zoonk/utils/shuffle";
import {
  segmentLearnerWords,
  segmentWords,
  stripPunctuation,
  trimPunctuation,
} from "@zoonk/utils/string";
import {
  type StepContentByKind,
  parseStepContent,
  safeParseStepContent,
} from "../../library/steps/contract/step-contract";
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

/** Texts with the same key share one Word row and its audio. */
export function normalizeWordKey({ language, word }: { language: string; word: string }): string {
  return trimPunctuation(word).toLocaleLowerCase(language);
}

function splitMultiWordEntries({
  language,
  lessonWord,
}: {
  language: string;
  lessonWord: SerializedWord;
}): [string, WordMetadata][] {
  const wordTokens = lessonWord.word.split(" ").filter(Boolean);

  if (wordTokens.length <= 1) {
    return [];
  }

  const romanizationTokens = lessonWord.romanization?.split(" ").filter(Boolean) ?? [];
  const canSlice = romanizationTokens.length === wordTokens.length;

  return wordTokens.map((token, index) => [
    normalizeWordKey({ language, word: token }),
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

function buildMergedWordMetadataLookup(
  entries: readonly (readonly [string, WordMetadata])[],
): Map<string, WordMetadata> {
  return entries.reduce(
    (lookup, [key, incoming]) =>
      lookup.set(key, mergeWordMetadata({ current: lookup.get(key), incoming })),
    new Map<string, WordMetadata>(),
  );
}

type WordOptionSources = {
  distractorWords: DistractorWord[];
  language: string;
  lessonWords: SerializedWord[];
  sentenceWordMap: Map<string, WordDataInput>;
};

function buildWordMetadataLookup(params: WordOptionSources): Map<string, WordMetadata> {
  const { language } = params;

  const lessonEntries = params.lessonWords.flatMap((lessonWord) => [
    ...splitMultiWordEntries({ language, lessonWord }),
    [
      normalizeWordKey({ language, word: lessonWord.word }),
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
        normalizeWordKey({ language, word: word.word }),
        { audioUrl: word.audioUrl, romanization: word.romanization, translation: null },
      ] as const,
  );

  const sentenceEntries = [...params.sentenceWordMap.values()].map(
    (word) =>
      [
        normalizeWordKey({ language, word: word.word }),
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

function createWordOptionBuilder(params: WordOptionSources): (word: string) => WordBankOption {
  const metadataLookup = buildWordMetadataLookup(params);

  return (word) => {
    const metadata = metadataLookup.get(normalizeWordKey({ language: params.language, word }));

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
export function buildSentenceWordOptions({
  sentence,
  ...sources
}: WordOptionSources & { sentence: string }): WordBankOption[] {
  const buildOption = createWordOptionBuilder(sources);
  return segmentWords(sentence).map((word) => buildOption(word));
}

export type LessonLanguages = { language: string; targetLanguage: string };

type BankSentence = { distractors: string[]; sentence: string };

type BankStep = { content: unknown; kind: string; sentenceId: string | null };

/**
 * Distractor tiles keep the case they are written in: it is part of the spelling ("Hund", "Sie",
 * "I"), and one that could start the sentence keeps the capital the real first word has.
 */
function getReadingBankWords(sentence: BankSentence) {
  return {
    correctWords: segmentWords(sentence.sentence),
    distractors: sanitizeDistractors({
      distractors: sentence.distractors,
      input: sentence.sentence,
      shape: "single-word",
    }),
  };
}

function getFillBlankWords(content: StepContentByKind["fillBlank"]): string[] {
  return [...content.answers, ...content.distractors];
}

type BankWordsInput = { sentences: ReadonlyMap<string, BankSentence> };

function getTargetBankWords({ sentences, step }: BankWordsInput & { step: BankStep }): string[] {
  const sentence = step.sentenceId ? sentences.get(step.sentenceId) : undefined;

  if (step.kind === "reading" && sentence) {
    const { correctWords, distractors } = getReadingBankWords(sentence);
    return [...correctWords, ...distractors];
  }

  if (step.kind !== "fillBlank") {
    return [];
  }

  const parsed = safeParseStepContent("fillBlank", step.content);
  return parsed.success ? getFillBlankWords(parsed.data) : [];
}

/** The target-language words a lesson's reading and fill-in-the-blank tiles show, as their Word rows save them. */
export function listTargetBankWords({
  sentences,
  steps,
}: BankWordsInput & { steps: readonly BankStep[] }): string[] {
  return steps
    .flatMap((step) => getTargetBankWords({ sentences, step }))
    .map((word) => trimPunctuation(word))
    .filter(Boolean);
}

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
      ...getReadingBankWords(step.sentence),
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

  const distractors = shuffle(removeCanonicalWordCollisions(config)).slice(
    0,
    WORD_BANK_DISTRACTOR_LIMIT,
  );

  const words = shuffle([...config.correctWords, ...distractors]);

  const buildOption = config.usesTargetLanguageMetadata
    ? createWordOptionBuilder({
        distractorWords,
        language: languages.targetLanguage,
        lessonWords,
        sentenceWordMap,
      })
    : emptyWordOption;

  return words.map((word) => buildOption(word));
}

/** Only a language lesson loads target words, so other lessons' tiles stay silent. */
export function buildFillBlankOptions({
  step,
  ...sources
}: WordOptionSources & { step: SerializedStep }): WordBankOption[] {
  if (step.kind !== "fillBlank") {
    return [];
  }

  const content = parseStepContent("fillBlank", step.content);
  const buildOption = createWordOptionBuilder(sources);

  return shuffle(getFillBlankWords(content)).map((word) => {
    const option = buildOption(word);
    const romanization = content.romanizations?.[word];

    return romanization
      ? { ...option, romanization: getTileRomanization({ romanization, word }) }
      : option;
  });
}
