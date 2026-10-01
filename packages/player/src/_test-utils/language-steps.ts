import { type PlayableLanguageStep } from "@zoonk/core/lesson-player/contract";
import { type ExerciseKind } from "@zoonk/core/player/contracts/exercise-content";
import {
  type ExerciseResources,
  serializeExerciseSteps,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";

/**
 * Language exercises as the server serves them, serialized with their word banks by the function
 * the lesson read uses. Their pair is `languageLessonFixture`'s: English for Portuguese speakers,
 * the word "rent" and the sentence "How much is the rent?".
 */

const RENT = {
  audioUrl: null,
  distractors: ["deposit", "bill"],
  id: crypto.randomUUID(),
  pronunciation: "rént",
  romanization: null,
  translation: "aluguel",
  word: "rent",
};

const HOW_MUCH = {
  audioUrl: null,
  distractors: ["are", "many"],
  explanation: "How much vem antes do verbo, como quanto em português.",
  id: crypto.randomUUID(),
  romanization: null,
  sentence: "How much is the rent?",
  translation: "Quanto é o aluguel?",
  translationDistractors: ["renda", "custa"],
};

const PAIR: ExerciseResources = {
  distractorWords: [],
  lessonSentences: [HOW_MUCH],
  lessonWords: [RENT],
  sentenceWords: [RENT],
};

/** Word screens show the word's note and sound tip for this language pair. */
const RENT_HINTS = {
  note: "Não confunda com renda, que é income.",
  pronunciationTip: "O r do começo é suave, não como em rato.",
};

const WORD_KINDS = new Set<ExerciseKind>(["translation", "vocabulary"]);
const SENTENCE_KINDS = new Set<ExerciseKind>(["listening", "reading"]);

/** Word and sentence screens read the pair; the others store their own content. */
const STORED_CONTENT: Partial<Record<ExerciseKind, object>> = {
  alphabet: {
    audioText: "あ",
    audioUrl: null,
    forms: [{ label: "Katakana", symbol: "ア" }],
    pronunciation: "a",
    readingAid: "Like the a in father",
    symbol: "あ",
  },
  fillBlank: playableStepContent.fillBlank,
  matchColumns: {
    pairs: [
      { left: "Electron", right: "Negative charge" },
      { left: "Proton", right: "Positive charge" },
      { left: "Neutron", right: "No charge" },
    ],
    question: "Match each particle to its charge",
  },
  multipleChoice: playableStepContent.multipleChoice,
};

/**
 * A language exercise of the given kind on the shared pair, with the word's hints where shown. A
 * kind that stores its own content takes `content` in place of the shared one.
 */
export function languageStep(
  kind: ExerciseKind,
  content: object = STORED_CONTENT[kind] ?? {},
): PlayableLanguageStep {
  const id = crypto.randomUUID();

  const [exercise] = serializeExerciseSteps({
    resources: PAIR,
    steps: [
      {
        content,
        id,
        kind,
        position: 0,
        sentence: SENTENCE_KINDS.has(kind) ? HOW_MUCH : null,
        word: WORD_KINDS.has(kind) ? RENT : null,
      },
    ],
  });

  if (!exercise) {
    throw new Error(`The ${kind} exercise didn't serialize`);
  }

  return {
    exercise,
    id,
    kind,
    position: 0,
    skillId: null,
    wordHints: WORD_KINDS.has(kind) ? RENT_HINTS : null,
  };
}
