import {
  type LessonSentence,
  type LessonWord,
  type Sentence,
  type Word,
  type WordPronunciation,
} from "@zoonk/db";

type LessonWordWithRelations = LessonWord & {
  word: Word & { pronunciations: WordPronunciation[] };
};

type LessonSentenceWithRelations = LessonSentence & {
  sentence: Sentence;
};

type WordDataInput = {
  id: bigint;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
  translation: string;
  alternativeTranslations: string[];
  pronunciation: string | null;
};

type SentenceDataInput = {
  id: bigint;
  sentence: string;
  alternativeSentences: string[];
  romanization: string | null;
  audioUrl: string | null;
  translation: string;
  alternativeTranslations: string[];
  explanation: string | null;
};

type StepWithDbRelations = {
  id: bigint;
  content: unknown;
  kind: string;
  position: number;
  word: Word | null;
  sentence: Sentence | null;
};

type StepWithTranslations = {
  id: bigint;
  content: unknown;
  kind: string;
  position: number;
  word: WordDataInput | null;
  sentence: SentenceDataInput | null;
};

/**
 * Maps a `LessonWord` (junction table record with word + pronunciations)
 * to the flat `WordDataInput` shape expected by `prepareActivityData`.
 * Translations and pronunciation now live on the junction table and
 * `WordPronunciation` respectively, so we flatten them here.
 */
function toLessonWordInput(lessonWord: LessonWordWithRelations): WordDataInput {
  return {
    alternativeTranslations: lessonWord.alternativeTranslations,
    audioUrl: lessonWord.word.audioUrl,
    id: lessonWord.word.id,
    pronunciation: lessonWord.word.pronunciations[0]?.pronunciation ?? null,
    romanization: lessonWord.word.romanization,
    translation: lessonWord.translation,
    word: lessonWord.word.word,
  };
}

/**
 * Maps an array of `LessonWord` junction records to flat `WordDataInput[]`.
 * Used by the activity page to bridge `getLessonWords` output to the
 * player's `prepareActivityData` input.
 */
export function toLessonWordInputs(lessonWords: LessonWordWithRelations[]): WordDataInput[] {
  return lessonWords.map((lw) => toLessonWordInput(lw));
}

/**
 * Maps a `LessonSentence` (junction table record with sentence relation)
 * to the flat `SentenceDataInput` shape expected by `prepareActivityData`.
 * Translation and explanation now live on the junction table instead of
 * a separate `SentenceTranslation` model.
 */
function toLessonSentenceInput(lessonSentence: LessonSentenceWithRelations): SentenceDataInput {
  return {
    alternativeSentences: lessonSentence.sentence.alternativeSentences,
    alternativeTranslations: lessonSentence.alternativeTranslations,
    audioUrl: lessonSentence.sentence.audioUrl,
    explanation: lessonSentence.explanation,
    id: lessonSentence.sentence.id,
    romanization: lessonSentence.sentence.romanization,
    sentence: lessonSentence.sentence.sentence,
    translation: lessonSentence.translation,
  };
}

/**
 * Maps an array of `LessonSentence` junction records to flat `SentenceDataInput[]`.
 * Used by the activity page to bridge `getLessonSentences` output to the
 * player's `prepareActivityData` input.
 */
export function toLessonSentenceInputs(
  lessonSentences: LessonSentenceWithRelations[],
): SentenceDataInput[] {
  return lessonSentences.map((ls) => toLessonSentenceInput(ls));
}

/**
 * Maps sentence words to flat `WordDataInput[]`. Sentence words use the
 * same `LessonWord` junction format as lesson words, so the mapping is identical.
 */
export function toSentenceWordInputs(sentenceWords: LessonWordWithRelations[]): WordDataInput[] {
  return sentenceWords.map((sw) => toLessonWordInput(sw));
}

/**
 * Maps fallback distractor words to flat `WordDataInput[]`. Fallback words also
 * use the `LessonWord` junction format, so the mapping is identical.
 */
export function toFallbackWordInputs(fallbackWords: LessonWordWithRelations[]): WordDataInput[] {
  return fallbackWords.map((fw) => toLessonWordInput(fw));
}

/**
 * Attaches lesson-scoped translations to activity steps. Steps from the
 * DB include raw `Word` and `Sentence` models (which don't carry translations),
 * so we look up each step's word/sentence in the `LessonWord`/`LessonSentence`
 * junction records to produce the flat translation fields that
 * `prepareActivityData` expects.
 */
export function attachTranslationsToSteps(
  steps: StepWithDbRelations[],
  lessonWords: LessonWordWithRelations[],
  lessonSentences: LessonSentenceWithRelations[],
): StepWithTranslations[] {
  const wordMap = new Map(lessonWords.map((lw) => [lw.wordId, lw]));
  const sentenceMap = new Map(lessonSentences.map((ls) => [ls.sentenceId, ls]));

  return steps.map((step) => ({
    content: step.content,
    id: step.id,
    kind: step.kind,
    position: step.position,
    sentence: step.sentence ? mergeSentenceWithTranslation(step.sentence, sentenceMap) : null,
    word: step.word ? mergeWordWithTranslation(step.word, wordMap) : null,
  }));
}

/**
 * Merges a raw `Word` with its lesson-scoped translation and pronunciation
 * from the matching `LessonWord` record to produce a flat `WordDataInput`.
 * Falls back to empty translation when no `LessonWord` match exists (e.g.
 * the word was removed from the lesson but still referenced by a step).
 */
function mergeWordWithTranslation(
  word: Word,
  wordMap: Map<bigint, LessonWordWithRelations>,
): WordDataInput {
  const lessonWord = wordMap.get(word.id);

  return {
    alternativeTranslations: lessonWord?.alternativeTranslations ?? [],
    audioUrl: word.audioUrl,
    id: word.id,
    pronunciation: lessonWord?.word.pronunciations[0]?.pronunciation ?? null,
    romanization: word.romanization,
    translation: lessonWord?.translation ?? "",
    word: word.word,
  };
}

/**
 * Merges a raw `Sentence` with its lesson-scoped translation and explanation
 * from the matching `LessonSentence` record to produce a flat `SentenceDataInput`.
 * Falls back to empty translation when no match exists.
 */
function mergeSentenceWithTranslation(
  sentence: Sentence,
  sentenceMap: Map<bigint, LessonSentenceWithRelations>,
): SentenceDataInput {
  const lessonSentence = sentenceMap.get(sentence.id);

  return {
    alternativeSentences: sentence.alternativeSentences,
    alternativeTranslations: lessonSentence?.alternativeTranslations ?? [],
    audioUrl: sentence.audioUrl,
    explanation: lessonSentence?.explanation ?? null,
    id: sentence.id,
    romanization: sentence.romanization,
    sentence: sentence.sentence,
    translation: lessonSentence?.translation ?? "",
  };
}
