import { shuffle } from "@zoonk/utils/shuffle";
import { hasWholePhrase, segmentWords, stripPunctuation } from "@zoonk/utils/string";
import {
  buildAcceptedArrangeWordSequences,
  getAcceptedArrangeWordSet,
} from "./arrange-words-answers";
import { isSemanticMatch } from "./get-distractor-words";
import {
  type SerializedStep,
  type SerializedWord,
  type WordBankOption,
} from "./prepare-activity-data";

const MIN_WORD_BANK_DISTRACTOR_COUNT = 4;
const WORD_BANK_DISTRACTOR_COUNT = 8;

type WordDataInput = {
  romanization: string | null;
  translation: string;
  word: string;
  wordAudio: { audioUrl: string } | null;
};

/**
 * Word-bank matching should ignore punctuation and case so "Morgen" and "Morgen!"
 * resolve to the same metadata. Keeping that rule in one helper prevents the reading
 * options, distractor filtering, and sentence-word lookup from drifting apart.
 */
function normalizeWordKey(word: string): string {
  return stripPunctuation(word).toLowerCase().trim();
}

/**
 * Reading word-bank options need fast metadata lookup by normalized token. Building
 * the map once keeps the top-level pipeline declarative and avoids repeated scans.
 */
function buildLessonWordLookup(
  serializedLessonWords: SerializedWord[],
): Map<string, SerializedWord> {
  return new Map(
    serializedLessonWords.map((lessonWord) => [normalizeWordKey(lessonWord.word), lessonWord]),
  );
}

/**
 * Fallback distractors should render with the same metadata as lesson distractors.
 * We merge both sources into one lookup and keep lesson words last so the visible
 * lesson payload stays the source of truth if both pools contain the same token.
 */
function buildWordMetadataLookup(
  serializedLessonWords: SerializedWord[],
  fallbackLessonWords: SerializedWord[],
): Map<string, SerializedWord> {
  return buildLessonWordLookup([...fallbackLessonWords, ...serializedLessonWords]);
}

/**
 * The incoming map can be keyed with raw words, but the player resolves options with
 * normalized tokens. Re-key the values here so callers do not need to care which form
 * the original map used.
 */
function buildSentenceWordLookup(
  sentenceWordMap: Map<string, WordDataInput>,
): Map<string, WordDataInput> {
  return new Map(
    [...sentenceWordMap.values()].map((sentenceWord) => [
      normalizeWordKey(sentenceWord.word),
      sentenceWord,
    ]),
  );
}

/**
 * Sentence-level metadata is more specific than lesson-level metadata, so we prefer it
 * whenever both sources describe the same normalized token.
 */
function getWordMetadata(
  word: string,
  lessonWordLookup: Map<string, SerializedWord>,
  sentenceWordLookup: Map<string, WordDataInput>,
): Omit<WordBankOption, "word"> {
  const key = normalizeWordKey(word);
  const sentenceWord = sentenceWordLookup.get(key);
  const lessonWord = lessonWordLookup.get(key);

  return {
    audioUrl: sentenceWord?.wordAudio?.audioUrl ?? lessonWord?.audioUrl ?? null,
    romanization: sentenceWord?.romanization ?? lessonWord?.romanization ?? null,
    translation: sentenceWord?.translation ?? lessonWord?.translation ?? null,
  };
}

/**
 * Reading steps show rich metadata for each token. Wrapping that in one builder means
 * the rest of the file can map words without branching on every iteration.
 */
function createEnrichedWordOptionBuilder(
  serializedLessonWords: SerializedWord[],
  fallbackLessonWords: SerializedWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): (word: string) => WordBankOption {
  const lessonWordLookup = buildWordMetadataLookup(serializedLessonWords, fallbackLessonWords);
  const sentenceWordLookup = buildSentenceWordLookup(sentenceWordMap);

  return (word) => ({
    ...getWordMetadata(word, lessonWordLookup, sentenceWordLookup),
    word,
  });
}

function emptyWordOption(word: string): WordBankOption {
  return { audioUrl: null, romanization: null, translation: null, word };
}

/**
 * Only reading and listening sentence steps produce arrange-words banks. Returning a
 * small config object lets the rest of the builder follow one shared flow.
 */
function getWordBankConfig(step: SerializedStep): {
  acceptedTexts: string[];
  acceptedWordSequences: string[][];
  primaryText: string;
  distractorField: "word" | "translation";
} | null {
  if (step.kind === "reading" && step.sentence) {
    return {
      acceptedTexts: [step.sentence.sentence, ...step.sentence.alternativeSentences],
      acceptedWordSequences: buildAcceptedArrangeWordSequences(
        step.sentence.sentence,
        step.sentence.alternativeSentences,
      ),
      distractorField: "word",
      primaryText: step.sentence.sentence,
    };
  }

  if (step.kind === "listening" && step.sentence) {
    return {
      acceptedTexts: [step.sentence.translation, ...step.sentence.alternativeTranslations],
      acceptedWordSequences: buildAcceptedArrangeWordSequences(
        step.sentence.translation,
        step.sentence.alternativeTranslations,
      ),
      distractorField: "translation",
      primaryText: step.sentence.translation,
    };
  }

  return null;
}

/**
 * Reading distractors match lesson words against the original word field, while
 * listening distractors must also consider alternative translations that mean the
 * same thing to the learner.
 */
function getCandidatePhrases(
  lessonWord: SerializedWord,
  distractorField: "word" | "translation",
): string[] {
  return distractorField === "word"
    ? [lessonWord.word]
    : [lessonWord.translation, ...lessonWord.alternativeTranslations];
}

/**
 * Phrase membership is its own rule because `includes` would treat short words like
 * "he" as if they matched inside unrelated text such as "the".
 */
function matchesAcceptedTexts(acceptedTexts: string[], phrase: string): boolean {
  return acceptedTexts.some((acceptedText) => hasWholePhrase(acceptedText, phrase));
}

/**
 * We only want semantic-equivalence filtering to run against words that actually appear
 * in one accepted answer, otherwise unrelated lesson words would remove good distractors.
 */
function isAcceptedLessonWord(
  lessonWord: SerializedWord,
  acceptedTexts: string[],
  distractorField: "word" | "translation",
): boolean {
  return getCandidatePhrases(lessonWord, distractorField).some(
    (phrase) => phrase.length > 0 && matchesAcceptedTexts(acceptedTexts, phrase),
  );
}

function getAcceptedLessonWords(
  serializedLessonWords: SerializedWord[],
  acceptedTexts: string[],
  distractorField: "word" | "translation",
): SerializedWord[] {
  return serializedLessonWords.filter((lessonWord) =>
    isAcceptedLessonWord(lessonWord, acceptedTexts, distractorField),
  );
}

/**
 * Once we know which lesson words are present in accepted answers, we can remove any
 * distractor that means the same thing. Keeping that rule separate makes the main
 * builder read like a pipeline instead of nested predicate logic.
 */
function isEquivalentToAcceptedLessonWord(
  lessonWord: SerializedWord,
  acceptedLessonWords: SerializedWord[],
): boolean {
  return acceptedLessonWords.some((acceptedLessonWord) =>
    isSemanticMatch(acceptedLessonWord, lessonWord),
  );
}

/**
 * We compare every distractor candidate against the lesson words that appear in
 * accepted answers so fallback pools follow the same ambiguity rules as lesson words.
 */
function filterEquivalentLessonWords(
  candidateLessonWords: SerializedWord[],
  acceptedLessonWords: SerializedWord[],
): SerializedWord[] {
  if (acceptedLessonWords.length === 0) {
    return candidateLessonWords;
  }

  return candidateLessonWords.filter(
    (lessonWord) => !isEquivalentToAcceptedLessonWord(lessonWord, acceptedLessonWords),
  );
}

/**
 * Reading sentence chips and reading word-bank chips share the same enrichment rule, so
 * both callers should build options through one normalized lookup function.
 */
export function buildSentenceWordOptions(
  sentence: string,
  serializedLessonWords: SerializedWord[],
  sentenceWordMap: Map<string, WordDataInput>,
): WordBankOption[] {
  const buildOption = createEnrichedWordOptionBuilder(serializedLessonWords, [], sentenceWordMap);

  return segmentWords(sentence).map((word) => buildOption(word));
}

/**
 * Correct answers and distractors must be tokenized the same way, especially for
 * languages that do not use spaces between words. `segmentWords` is the shared token
 * source of truth, so distractors do not drift from answer validation or sentence chips.
 */
function getUniqueDistractorWords(
  lessonWords: SerializedWord[],
  distractorField: "word" | "translation",
  acceptedWordSet: Set<string>,
  excludedWordKeys = new Set<string>(),
): string[] {
  return [
    ...new Map(
      lessonWords
        .flatMap((lessonWord) => segmentWords(lessonWord[distractorField]))
        .flatMap((word) => {
          const key = normalizeWordKey(word);

          return key.length > 0 && !acceptedWordSet.has(key) && !excludedWordKeys.has(key)
            ? [[key, word] as const]
            : [];
        }),
    ).values(),
  ];
}

/**
 * Lesson distractors should stay primary, while fallback words only fill genuine
 * gaps when semantic filtering leaves fewer than four visible distractors.
 */
function buildDistractorWords(
  lessonWords: SerializedWord[],
  fallbackLessonWords: SerializedWord[],
  acceptedLessonWords: SerializedWord[],
  acceptedWordSet: Set<string>,
  distractorField: "word" | "translation",
): string[] {
  const lessonDistractorWords = shuffle(
    getUniqueDistractorWords(
      filterEquivalentLessonWords(lessonWords, acceptedLessonWords),
      distractorField,
      acceptedWordSet,
    ),
  ).slice(0, WORD_BANK_DISTRACTOR_COUNT);

  if (lessonDistractorWords.length >= MIN_WORD_BANK_DISTRACTOR_COUNT) {
    return lessonDistractorWords;
  }

  const fallbackDistractorWords = shuffle(
    getUniqueDistractorWords(
      filterEquivalentLessonWords(fallbackLessonWords, acceptedLessonWords),
      distractorField,
      acceptedWordSet,
      new Set(lessonDistractorWords.map((word) => normalizeWordKey(word))),
    ),
  ).slice(0, MIN_WORD_BANK_DISTRACTOR_COUNT - lessonDistractorWords.length);

  return [...lessonDistractorWords, ...fallbackDistractorWords];
}

/**
 * Listening word banks intentionally hide metadata, while reading word banks expose it.
 * Choosing the builder once keeps the option creation flow flat and easier to compose.
 */
function createWordBankOptionBuilder(
  stepKind: SerializedStep["kind"],
  serializedLessonWords: SerializedWord[],
  sentenceWordMap: Map<string, WordDataInput>,
  fallbackLessonWords: SerializedWord[],
): (word: string) => WordBankOption {
  if (stepKind !== "reading") {
    return emptyWordOption;
  }

  return createEnrichedWordOptionBuilder(
    serializedLessonWords,
    fallbackLessonWords,
    sentenceWordMap,
  );
}

export function buildWordBankOptions(
  step: SerializedStep,
  serializedLessonWords: SerializedWord[],
  sentenceWordMap: Map<string, WordDataInput>,
  fallbackLessonWords: SerializedWord[] = [],
): WordBankOption[] {
  const config = getWordBankConfig(step);

  if (!config) {
    return [];
  }

  const { acceptedTexts, acceptedWordSequences, distractorField, primaryText } = config;

  const buildOption = createWordBankOptionBuilder(
    step.kind,
    serializedLessonWords,
    sentenceWordMap,
    fallbackLessonWords,
  );

  const acceptedWordSet = getAcceptedArrangeWordSet(acceptedWordSequences);
  const acceptedLessonWords = getAcceptedLessonWords(
    serializedLessonWords,
    acceptedTexts,
    distractorField,
  );
  const correctOptions = segmentWords(primaryText).map((word) => buildOption(word));
  const distractorOptions = buildDistractorWords(
    serializedLessonWords,
    fallbackLessonWords,
    acceptedLessonWords,
    acceptedWordSet,
    distractorField,
  ).map((word) => buildOption(word));

  return shuffle([...correctOptions, ...distractorOptions]);
}
