export type LessonPronunciationInput = {
  pronunciation: string;
};

export type WordRecordInput = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
  pronunciations: LessonPronunciationInput[];
};

export type SentenceRecordInput = {
  id: string;
  sentence: string;
  romanization: string | null;
  audioUrl: string | null;
};

export type LessonWordInput = {
  translation: string;
  distractors: string[];
  word: WordRecordInput;
};

export type LessonSentenceInput = {
  translation: string;
  distractors: string[];
  translationDistractors: string[];
  explanation: string | null;
  sentence: SentenceRecordInput;
};

export type LessonDistractorWordInput = WordRecordInput;

export type WordDataInput = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
  translation: string;
  distractors: string[];
  pronunciation: string | null;
};

export type SentenceDataInput = {
  id: string;
  sentence: string;
  distractors: string[];
  romanization: string | null;
  audioUrl: string | null;
  translation: string;
  translationDistractors: string[];
  explanation: string | null;
};

export type DistractorWordDataInput = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
  pronunciation: string | null;
};

export type StepDataInput = {
  id: string;
  content: unknown;
  kind: string;
  position: number;
  word: WordDataInput | null;
  sentence: SentenceDataInput | null;
};

export type LessonStepInput = {
  id: string;
  content: unknown;
  kind: string;
  position: number;
  word: Omit<WordRecordInput, "pronunciations"> | null;
  sentence: SentenceRecordInput | null;
};

/**
 * Maps a lesson-scoped word row to the flat player input shape.
 *
 * `prepareLessonData` should only receive plain serializable data, not database-shaped
 * objects. Keeping this mapping here lets the player own the shape it expects while the
 * app passes whatever relation objects it already loaded.
 */
function toLessonWordInput(lessonWord: LessonWordInput): WordDataInput {
  return {
    audioUrl: lessonWord.word.audioUrl,
    distractors: lessonWord.distractors,
    id: lessonWord.word.id,
    pronunciation: lessonWord.word.pronunciations[0]?.pronunciation ?? null,
    romanization: lessonWord.word.romanization,
    translation: lessonWord.translation,
    word: lessonWord.word.word,
  };
}

/**
 * Maps lesson-scoped vocabulary rows to the flat shape consumed by `prepareLessonData`.
 */
export function toLessonWordInputs(lessonWords: LessonWordInput[]): WordDataInput[] {
  return lessonWords.map((lessonWord) => toLessonWordInput(lessonWord));
}

/**
 * Maps a lesson-scoped sentence row to the flat player input shape.
 *
 * Sentence distractors and learner-language distractors live on the lesson row, while
 * shared audio and romanization stay on the canonical sentence record.
 */
function toLessonSentenceInput(lessonSentence: LessonSentenceInput): SentenceDataInput {
  return {
    audioUrl: lessonSentence.sentence.audioUrl,
    distractors: lessonSentence.distractors,
    explanation: lessonSentence.explanation,
    id: lessonSentence.sentence.id,
    romanization: lessonSentence.sentence.romanization,
    sentence: lessonSentence.sentence.sentence,
    translation: lessonSentence.translation,
    translationDistractors: lessonSentence.translationDistractors,
  };
}

/**
 * Maps lesson-scoped sentence rows to the flat shape consumed by `prepareLessonData`.
 */
export function toLessonSentenceInputs(
  lessonSentences: LessonSentenceInput[],
): SentenceDataInput[] {
  return lessonSentences.map((lessonSentence) => toLessonSentenceInput(lessonSentence));
}

/**
 * Canonical sentence words use the same lesson-word format as the main lesson vocabulary,
 * so the player can reuse the same mapping rule for both.
 */
export function toSentenceWordInputs(sentenceWords: LessonWordInput[]): WordDataInput[] {
  return sentenceWords.map((sentenceWord) => toLessonWordInput(sentenceWord));
}

/**
 * Target-language distractor words are not lesson words.
 *
 * The player only needs lightweight render metadata for them, so this keeps the mapped
 * shape small and avoids inventing lesson-scoped translations where none exist.
 */
function toDistractorWordInput(word: LessonDistractorWordInput): DistractorWordDataInput {
  return {
    audioUrl: word.audioUrl,
    id: word.id,
    pronunciation: word.pronunciations[0]?.pronunciation ?? null,
    romanization: word.romanization,
    word: word.word,
  };
}

/**
 * Maps hydrated target-language distractor words to the flat player input shape.
 */
export function toDistractorWordInputs(
  distractorWords: LessonDistractorWordInput[],
): DistractorWordDataInput[] {
  return distractorWords.map((word) => toDistractorWordInput(word));
}

/**
 * Attaches lesson-scoped translations and distractors to raw step records.
 *
 * Database steps point at canonical `Word` and `Sentence` rows. The player needs the
 * lesson-scoped translation and distractor arrays merged in before serialization, so this
 * helper performs that merge once in a pure, testable place.
 */
export function attachTranslationsToSteps(
  steps: LessonStepInput[],
  lessonWords: LessonWordInput[],
  lessonSentences: LessonSentenceInput[],
): StepDataInput[] {
  const wordMap = new Map(lessonWords.map((lessonWord) => [lessonWord.word.id, lessonWord]));
  const sentenceMap = new Map(
    lessonSentences.map((lessonSentence) => [lessonSentence.sentence.id, lessonSentence]),
  );

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
 * Merges a raw word record with its lesson-scoped translation and distractor list.
 *
 * Some edge cases can leave a step without a matching lesson row, so this helper also
 * defines the empty fallback shape instead of making callers reimplement it.
 */
function mergeWordWithTranslation(
  word: Omit<WordRecordInput, "pronunciations">,
  wordMap: Map<string, LessonWordInput>,
): WordDataInput {
  const lessonWord = wordMap.get(word.id);

  return {
    audioUrl: word.audioUrl,
    distractors: lessonWord?.distractors ?? [],
    id: word.id,
    pronunciation: lessonWord?.word.pronunciations[0]?.pronunciation ?? null,
    romanization: word.romanization,
    translation: lessonWord?.translation ?? "",
    word: word.word,
  };
}

/**
 * Merges a raw sentence record with its lesson-scoped translation and distractor arrays.
 */
function mergeSentenceWithTranslation(
  sentence: SentenceRecordInput,
  sentenceMap: Map<string, LessonSentenceInput>,
): SentenceDataInput {
  const lessonSentence = sentenceMap.get(sentence.id);

  return {
    audioUrl: sentence.audioUrl,
    distractors: lessonSentence?.distractors ?? [],
    explanation: lessonSentence?.explanation ?? null,
    id: sentence.id,
    romanization: sentence.romanization,
    sentence: sentence.sentence,
    translation: lessonSentence?.translation ?? "",
    translationDistractors: lessonSentence?.translationDistractors ?? [],
  };
}
