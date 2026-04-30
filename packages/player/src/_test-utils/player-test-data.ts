import {
  type SerializedLesson,
  type SerializedSentence,
  type SerializedStep,
  type SerializedWord,
} from "@zoonk/core/player/contracts/prepare-lesson-data";

/**
 * Shared browser tests need a tiny canonical word shape so each scenario can
 * describe only the fields it actually cares about.
 */
export function buildSerializedWord(overrides: Partial<SerializedWord> = {}): SerializedWord {
  return {
    audioUrl: null,
    distractors: [],
    id: "word-1",
    pronunciation: null,
    romanization: null,
    translation: "Translation",
    word: "Word",
    ...overrides,
  };
}

/**
 * Reading and listening steps depend on sentence-level metadata. Centralizing
 * the defaults keeps those tests focused on the player flow instead of the raw
 * serialization boilerplate.
 */
export function buildSerializedSentence(
  overrides: Partial<SerializedSentence> = {},
): SerializedSentence {
  return {
    audioUrl: null,
    distractors: [],
    explanation: null,
    id: "sentence-1",
    romanization: null,
    sentence: "Sentence",
    translation: "Sentence translation",
    translationDistractors: [],
    ...overrides,
  };
}

/**
 * Most player scenarios only need one step. A static step is the smallest valid
 * default and individual tests can override the kind, content, and option data.
 */
export function buildSerializedStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id: "step-1",
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
    ...overrides,
  };
}

/**
 * Rendering the full provider and shell only requires serialized lesson data.
 * This helper keeps lesson-level noise out of the browser tests.
 */
export function buildSerializedLesson(overrides: Partial<SerializedLesson> = {}): SerializedLesson {
  return {
    description: null,
    id: "lesson-1",
    kind: "quiz",
    language: "en",
    lessonSentences: [],
    lessonWords: [],
    organizationId: "org-1",
    steps: [buildSerializedStep()],
    title: "Test Lesson",
    ...overrides,
  };
}
