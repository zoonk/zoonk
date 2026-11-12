import { type TestCase } from "@/lib/types";
import {
  type LanguageLessonContent,
  type LanguageLessonInputs,
} from "@zoonk/ai/tasks/language/language-lesson";
import { listLanguageReviewScreens } from "@zoonk/core/library/language/review-screens";
import { type LessonQualityCheckExpected } from "../lesson-quality-check/test-cases";
import { LANGUAGE_LESSONS, patchAt, plantSlip } from "./language-lessons";

export type LanguageLessonCheckInput = {
  lesson: LanguageLessonContent;
  writer: LanguageLessonInputs;
};

const { englishIntroductions, italianGreetings, italianPastWeather, spanishSlowly } =
  LANGUAGE_LESSONS;

/** The 1-based number the reviewer gives the first screen of `kind` whose content shows `text`. */
function screenOf(input: LanguageLessonCheckInput, kind: string, text: string): number {
  const screens = listLanguageReviewScreens({
    content: input.lesson,
    learnerLanguage: input.writer.learnerLanguage,
    targetLanguage: input.writer.targetLanguage,
  });

  const index = screens.findIndex(
    (screen) => screen.kind === kind && JSON.stringify(screen.content).includes(text),
  );

  if (index === -1) {
    throw new Error(`No ${kind} screen shows ${text}`);
  }

  return index + 1;
}

function clean(id: string, input: LanguageLessonCheckInput) {
  return { expected: { verdict: "pass" } as const, id, userInput: input };
}

function slip({
  id,
  input,
  kind,
  text,
}: {
  id: string;
  input: LanguageLessonCheckInput;
  kind: string;
  text: string;
}) {
  return {
    expected: { screen: screenOf(input, kind, text), verdict: "fail" } as const,
    id,
    userInput: input,
  };
}

/** The slips are the kinds learners met in published lessons (#2506, #2414). */
export const TEST_CASES: TestCase<LessonQualityCheckExpected, LanguageLessonCheckInput>[] = [
  clean("pt-it-greetings-clean", italianGreetings),
  clean("en-es-slowly-clean", spanishSlowly),
  clean("pt-en-introductions-clean", englishIntroductions),
  clean("pt-it-past-weather-clean", italianPastWeather),
  slip({
    id: "pt-it-greetings-buonanotte-also-right",
    input: plantSlip(italianGreetings, (lesson) => ({
      ...lesson,
      words: patchAt(lesson.words, 1, { distractors: ["buongiorno", "grazie", "buonanotte"] }),
    })),
    kind: "translation",
    text: "buonanotte",
  }),
  slip({
    id: "pt-it-greetings-closed-e-respelled-open",
    input: plantSlip(italianGreetings, (lesson) => ({
      ...lesson,
      words: patchAt(lesson.words, 1, { pronunciation: "buo-na-SÉ-ra" }),
    })),
    kind: "vocabulary",
    text: "SÉ-ra",
  }),
  slip({
    id: "pt-it-greetings-split-word-typo",
    input: plantSlip(italianGreetings, (lesson) => ({
      ...lesson,
      sentences: patchAt(lesson.sentences, 0, {
        speakingPrompt: "Cumpri mente a senhora Rossi de manhã.",
      }),
    })),
    kind: "spokenAnswer",
    text: "Cumpri mente",
  }),
  slip({
    id: "en-es-slowly-informal-tile-also-right",
    input: plantSlip(spanishSlowly, (lesson) => ({
      ...lesson,
      sentences: patchAt(lesson.sentences, 1, { distractors: ["Puedes", "rápido"] }),
    })),
    kind: "reading",
    text: "Puedes",
  }),
  slip({
    id: "en-es-slowly-respelling-contradicts-tip",
    input: plantSlip(spanishSlowly, (lesson) => ({
      ...lesson,
      words: patchAt(lesson.words, 2, { pronunciation: "OH-trah VEHS" }),
    })),
    kind: "vocabulary",
    text: "VEHS",
  }),
  slip({
    id: "pt-en-introductions-own-name-fixed-target",
    input: plantSlip(englishIntroductions, (lesson) => ({
      ...lesson,
      sentences: patchAt(lesson.sentences, 0, { speakingPrompt: "Apresente-se usando seu nome." }),
    })),
    kind: "spokenAnswer",
    text: "Apresente-se usando seu nome",
  }),
  slip({
    id: "pt-en-introductions-letter-gives-answer-away",
    input: plantSlip(englishIntroductions, (lesson) => ({
      ...lesson,
      words: patchAt(lesson.words, 0, {
        distractors: ["B", "C", "D"],
        note: null,
        pronunciation: "ÊI",
        tip: null,
        translation: "a letra A",
        word: "A",
      }),
    })),
    kind: "translation",
    text: "a letra A",
  }),
  slip({
    id: "pt-en-introductions-split-word-typo",
    input: plantSlip(englishIntroductions, (lesson) => ({
      ...lesson,
      practice: patchAt(lesson.practice, 0, {
        question: "Comple te para dizer que você é do Brasil.",
      }),
    })),
    kind: "fillBlank",
    text: "Comple te",
  }),
  slip({
    id: "pt-it-past-weather-split-non-word",
    input: plantSlip(italianPastWeather, (lesson) => ({
      ...lesson,
      practice: patchAt(lesson.practice, 0, { distractors: ["piove", "grand inava"] }),
    })),
    kind: "fillBlank",
    text: "grand inava",
  }),
];
