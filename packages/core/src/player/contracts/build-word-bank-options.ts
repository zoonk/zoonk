import { type DistractorShape, sanitizeDistractors } from "@zoonk/utils/distractors";
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
export function normalizeWordKey(word: string): string {
  return trimPunctuation(word).toLowerCase();
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

function buildMergedWordMetadataLookup(
  entries: readonly (readonly [string, WordMetadata])[],
): Map<string, WordMetadata> {
  return entries.reduce(
    (lookup, [key, incoming]) =>
      lookup.set(key, mergeWordMetadata({ current: lookup.get(key), incoming })),
    new Map<string, WordMetadata>(),
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

type BankSentence = { distractors: string[]; sentence: string };

type BankStep = { content: unknown; kind: string; sentenceId: string | null };

/** Distractors show in lowercase so capitalization cannot reveal extra tiles. */
function toDistractorTiles({
  distractors,
  input,
  language,
  shape,
}: {
  distractors: string[];
  input: string;
  language: string;
  shape: DistractorShape;
}): string[] {
  return sanitizeDistractors({ distractors, input, shape }).map((distractor) =>
    distractor.toLocaleLowerCase(language),
  );
}

function getReadingBankWords({ language, sentence }: { language: string; sentence: BankSentence }) {
  return {
    correctWords: segmentWords(sentence.sentence),
    distractors: toDistractorTiles({
      distractors: sentence.distractors,
      input: sentence.sentence,
      language,
      shape: "single-word",
    }),
  };
}

function getFillBlankWords(content: StepContentByKind["fillBlank"]): string[] {
  return [...content.answers, ...content.distractors];
}

type BankWordsInput = { sentences: ReadonlyMap<string, BankSentence>; targetLanguage: string };

function getTargetBankWords({
  sentences,
  step,
  targetLanguage,
}: BankWordsInput & { step: BankStep }): string[] {
  const sentence = step.sentenceId ? sentences.get(step.sentenceId) : undefined;

  if (step.kind === "reading" && sentence) {
    const { correctWords, distractors } = getReadingBankWords({
      language: targetLanguage,
      sentence,
    });

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
  targetLanguage,
}: BankWordsInput & { steps: readonly BankStep[] }): string[] {
  return steps
    .flatMap((step) => getTargetBankWords({ sentences, step, targetLanguage }))
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
      ...getReadingBankWords({ language: languages.targetLanguage, sentence: step.sentence }),
      language: languages.targetLanguage,
      usesTargetLanguageMetadata: true,
    };
  }

  if (step.kind === "listening" && step.sentence) {
    return {
      correctWords: segmentLearnerWords(step.sentence.translation),
      distractors: toDistractorTiles({
        distractors: step.sentence.translationDistractors,
        input: step.sentence.translation,
        language: languages.language,
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
    ? createWordOptionBuilder({ distractorWords, lessonWords, sentenceWordMap })
    : emptyWordOption;

  return words.map((word) => buildOption(word));
}

/** Only a language lesson loads target words, so other lessons' tiles stay silent. */
export function buildFillBlankOptions(
  step: SerializedStep,
  lessonWords: SerializedWord[],
  distractorWords: DistractorWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption[] {
  if (step.kind !== "fillBlank") {
    return [];
  }

  const content = parseStepContent("fillBlank", step.content);
  const buildOption = createWordOptionBuilder({ distractorWords, lessonWords, sentenceWordMap });

  return shuffle(getFillBlankWords(content)).map((word) => {
    const option = buildOption(word);
    const romanization = content.romanizations?.[word];

    return romanization
      ? { ...option, romanization: getTileRomanization({ romanization, word }) }
      : option;
  });
}
