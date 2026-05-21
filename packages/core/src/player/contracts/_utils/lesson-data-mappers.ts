type LessonPronunciationInput = { pronunciation: string };

type WordRecordInput = {
  id: string;
  word: string;
  romanization: string | null;
  audioUrl: string | null;
  pronunciations: LessonPronunciationInput[];
};

type SentenceRecordInput = {
  id: string;
  sentence: string;
  romanization: string | null;
  audioUrl: string | null;
};

export type ChapterWordInput = {
  id: string;
  translation: string;
  distractors: string[];
  word: WordRecordInput;
};

export type ChapterSentenceInput = {
  id: string;
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
  chapterSentenceId: string | null;
  chapterWordId: string | null;
  content: unknown;
  kind: string;
  position: number;
  word: Omit<WordRecordInput, "pronunciations"> | null;
  sentence: SentenceRecordInput | null;
};

/**
 * Maps a chapter-scoped word row to the flat player input shape.
 *
 * `prepareLessonData` should only receive plain serializable data, not database-shaped
 * objects. Keeping this mapping here lets the player own the shape it expects while the
 * app passes whatever relation objects it already loaded.
 */
function toChapterWordInput(chapterWord: ChapterWordInput): WordDataInput {
  return {
    audioUrl: chapterWord.word.audioUrl,
    distractors: chapterWord.distractors,
    id: chapterWord.word.id,
    pronunciation: chapterWord.word.pronunciations[0]?.pronunciation ?? null,
    romanization: chapterWord.word.romanization,
    translation: chapterWord.translation,
    word: chapterWord.word.word,
  };
}

/**
 * Maps chapter-scoped vocabulary rows to the flat shape consumed by `prepareLessonData`.
 */
export function toChapterWordInputs(chapterWords: ChapterWordInput[]): WordDataInput[] {
  return chapterWords.map((chapterWord) => toChapterWordInput(chapterWord));
}

/**
 * Maps a chapter-scoped sentence row to the flat player input shape.
 *
 * Sentence distractors and learner-language distractors live on the chapter row, while
 * shared audio and romanization stay on the canonical sentence record.
 */
function toChapterSentenceInput(chapterSentence: ChapterSentenceInput): SentenceDataInput {
  return {
    audioUrl: chapterSentence.sentence.audioUrl,
    distractors: chapterSentence.distractors,
    explanation: chapterSentence.explanation,
    id: chapterSentence.sentence.id,
    romanization: chapterSentence.sentence.romanization,
    sentence: chapterSentence.sentence.sentence,
    translation: chapterSentence.translation,
    translationDistractors: chapterSentence.translationDistractors,
  };
}

/**
 * Maps chapter-scoped sentence rows to the flat shape consumed by `prepareLessonData`.
 */
export function toChapterSentenceInputs(
  chapterSentences: ChapterSentenceInput[],
): SentenceDataInput[] {
  return chapterSentences.map((chapterSentence) => toChapterSentenceInput(chapterSentence));
}

/**
 * Canonical sentence words use the same chapter-word format as the main lesson vocabulary,
 * so the player can reuse the same mapping rule for both.
 */
export function toSentenceWordInputs(sentenceWords: ChapterWordInput[]): WordDataInput[] {
  return sentenceWords.map((sentenceWord) => toChapterWordInput(sentenceWord));
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
 * Attaches chapter-scoped translations and distractors to raw step records.
 *
 * Database steps point at canonical `Word`/`Sentence` rows and at the exact
 * `ChapterWord`/`ChapterSentence` rows that contain generated learner-language
 * metadata. The player needs those scoped translations and distractor arrays
 * merged in before serialization.
 */
export function attachResourcesToSteps(
  steps: LessonStepInput[],
  chapterWords: ChapterWordInput[],
  chapterSentences: ChapterSentenceInput[],
): StepDataInput[] {
  const wordMap = new Map(chapterWords.map((chapterWord) => [chapterWord.id, chapterWord]));

  const sentenceMap = new Map(
    chapterSentences.map((chapterSentence) => [chapterSentence.id, chapterSentence]),
  );

  return steps.map((step) => ({
    content: step.content,
    id: step.id,
    kind: step.kind,
    position: step.position,
    sentence: step.sentence
      ? mergeSentenceWithResource({
          chapterSentenceId: step.chapterSentenceId,
          sentence: step.sentence,
          sentenceMap,
        })
      : null,
    word: step.word
      ? mergeWordWithResource({ chapterWordId: step.chapterWordId, word: step.word, wordMap })
      : null,
  }));
}

/**
 * Merges a raw word record with its chapter-scoped translation and distractor list.
 *
 * Some edge cases can leave a step without a matching chapter row, so this helper also
 * defines the empty fallback shape instead of making callers reimplement it.
 */
function mergeWordWithResource({
  chapterWordId,
  word,
  wordMap,
}: {
  chapterWordId: string | null;
  word: Omit<WordRecordInput, "pronunciations">;
  wordMap: Map<string, ChapterWordInput>;
}): WordDataInput {
  const chapterWord = chapterWordId ? wordMap.get(chapterWordId) : null;

  return {
    audioUrl: word.audioUrl,
    distractors: chapterWord?.distractors ?? [],
    id: word.id,
    pronunciation: chapterWord?.word.pronunciations[0]?.pronunciation ?? null,
    romanization: word.romanization,
    translation: chapterWord?.translation ?? "",
    word: word.word,
  };
}

/**
 * Merges a raw sentence record with its chapter-scoped translation and distractor arrays.
 */
function mergeSentenceWithResource({
  chapterSentenceId,
  sentence,
  sentenceMap,
}: {
  chapterSentenceId: string | null;
  sentence: SentenceRecordInput;
  sentenceMap: Map<string, ChapterSentenceInput>;
}): SentenceDataInput {
  const chapterSentence = chapterSentenceId ? sentenceMap.get(chapterSentenceId) : null;

  return {
    audioUrl: sentence.audioUrl,
    distractors: chapterSentence?.distractors ?? [],
    explanation: chapterSentence?.explanation ?? null,
    id: sentence.id,
    romanization: sentence.romanization,
    sentence: sentence.sentence,
    translation: chapterSentence?.translation ?? "",
    translationDistractors: chapterSentence?.translationDistractors ?? [],
  };
}
