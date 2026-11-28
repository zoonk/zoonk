import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { writesNumberInDigits } from "@zoonk/ai/tasks/language/language-lesson-rules";
import { parseStepContent } from "../../steps/contract/step-contract";
import { type LanguageStepToSave, buildLanguageLessonSteps } from "./language-lesson-steps";

export type LanguageReviewScreen = { kind: string; content: unknown };

type Word = LanguageLessonContent["words"][number];
type Sentence = LanguageLessonContent["sentences"][number];

function toOptions({ correct, wrong }: { correct: readonly string[]; wrong: readonly string[] }) {
  return [
    ...correct.map((text) => ({ isCorrect: true, text })),
    ...wrong.map((text) => ({ isCorrect: false, text })),
  ];
}

function toWordScreen({ kind, word }: { kind: string; word: Word }): LanguageReviewScreen {
  if (kind === "translation") {
    return {
      content: {
        options: toOptions({ correct: [word.word], wrong: word.distractors }),
        prompt: word.translation,
      },
      kind,
    };
  }

  const { note, pronunciation, romanization, tip, translation } = word;

  return {
    content: { note, pronunciation, romanization, tip, translation, word: word.word },
    kind,
  };
}

function toSentenceScreen({
  kind,
  sentence,
}: {
  kind: string;
  sentence: Sentence;
}): LanguageReviewScreen {
  const { explanation } = sentence;

  if (kind === "reading") {
    const { distractors, translation } = sentence;

    return {
      content: {
        answer: sentence.sentence,
        explanation,
        extraTiles: distractors,
        prompt: translation,
      },
      kind,
    };
  }

  return {
    content: {
      answer: sentence.translation,
      audio: sentence.sentence,
      explanation,
      extraTiles: sentence.translationDistractors,
    },
    kind,
  };
}

function toContentScreen(step: LanguageStepToSave): LanguageReviewScreen {
  if (step.kind !== "fillBlank") {
    return { content: step.content, kind: step.kind };
  }

  const { answers, distractors, ...blank } = parseStepContent("fillBlank", step.content);

  return {
    content: { ...blank, options: toOptions({ correct: answers, wrong: distractors }) },
    kind: step.kind,
  };
}

type ReviewScreensParams = {
  content: LanguageLessonContent;
  learnerLanguage: string;
  targetLanguage: string;
};

/** Steps point at words and sentences by position here instead of stored ids. */
function listScreenSteps({ content, learnerLanguage, targetLanguage }: ReviewScreensParams) {
  const steps = buildLanguageLessonSteps({
    content,
    learnerLanguage,
    sentenceIds: content.sentences.map((_, index) => String(index)),
    targetLanguage,
    wordIds: content.words.map((_, index) => String(index)),
  });

  return steps.map((step) => ({
    sentence: step.sentenceId === null ? undefined : content.sentences[Number(step.sentenceId)],
    step,
    word: step.wordId === null ? undefined : content.words[Number(step.wordId)],
  }));
}

function isTileSentence(step: LanguageStepToSave): boolean {
  return step.kind === "reading" || step.kind === "listening";
}

/**
 * The screens a lesson's content becomes, as learners see them: what a reviewer checks and numbers
 * its problems by.
 */
export function listLanguageReviewScreens(params: ReviewScreensParams): LanguageReviewScreen[] {
  return listScreenSteps(params).map(({ sentence, step, word }) => {
    if (word) {
      return toWordScreen({ kind: step.kind, word });
    }

    if (sentence && isTileSentence(step)) {
      return toSentenceScreen({ kind: step.kind, sentence });
    }

    return toContentScreen(step);
  });
}

/** The screens (by index) where the learner builds, from tiles, a sentence with a number in digits. */
export function listDigitTileScreens(
  params: ReviewScreensParams,
): { screen: number; sentence: string }[] {
  return listScreenSteps(params).flatMap(({ sentence, step }, screen) =>
    sentence &&
    isTileSentence(step) &&
    (writesNumberInDigits(sentence.sentence) || writesNumberInDigits(sentence.translation))
      ? [{ screen, sentence: sentence.sentence }]
      : [],
  );
}
