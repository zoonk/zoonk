import { type TestCase } from "@/lib/types";
import { type FixLanguageLessonParams } from "@zoonk/ai/tasks/language/language-lesson";
import { listLanguageReviewScreens } from "@zoonk/core/library/language/review-screens";
import { LANGUAGE_LESSONS, patchAt, plantSlip } from "../language-lesson-check/language-lessons";
import { type LanguageLessonCheckInput } from "../language-lesson-check/test-cases";

export type LanguageLessonFixInput = Omit<
  FixLanguageLessonParams,
  "analytics" | "model" | "reasoning" | "serviceTier" | "speed" | "useFallback"
>;

type Item = { field: string; index: number; list: "practice" | "sentences" | "words" };

/** `gone`: text a right fix removes from the flagged field. `kept`: a wrong finding, so nothing changes. */
export type LanguageLessonFixExpected = { gone: string; item: Item } | { kept: string };

const { italianGreetings, italianPastWeather, spanishSlowly } = LANGUAGE_LESSONS;

function toInput(
  { lesson, writer }: LanguageLessonCheckInput,
  problem: { screen: number; text: string },
): LanguageLessonFixInput {
  const screens = listLanguageReviewScreens({
    content: lesson,
    learnerLanguage: writer.learnerLanguage,
    targetLanguage: writer.targetLanguage,
  });

  return {
    ...writer,
    lesson,
    problems: [{ problem: problem.text, screen: problem.screen, source: "review" }],
    screens,
  };
}

/** Findings as the reviewer wrote them on published lessons with these slips (#2506, #2414). */
export const TEST_CASES: TestCase<LanguageLessonFixExpected, LanguageLessonFixInput>[] = [
  {
    expected: { gone: "grand inava", item: { field: "distractors", index: 0, list: "words" } },
    id: "pt-it-past-weather-split-non-word",
    userInput: toInput(
      plantSlip(italianPastWeather, (lesson) => ({
        ...lesson,
        words: patchAt(lesson.words, 0, { distractors: ["nevicava", "grand inava", "tuonava"] }),
      })),
      {
        screen: 5,
        text: "The option “grand inava” isn't an Italian word: it's “grandinava” split in two. Fix: Write it whole, “grandinava”, or use another real form.",
      },
    ),
  },
  {
    expected: { gone: "buonanotte", item: { field: "distractors", index: 1, list: "words" } },
    id: "pt-it-greetings-buonanotte-also-right",
    userInput: toInput(
      plantSlip(italianGreetings, (lesson) => ({
        ...lesson,
        words: patchAt(lesson.words, 1, { distractors: ["buongiorno", "grazie", "buonanotte"] }),
      })),
      {
        screen: 3,
        text: "The prompt “boa noite” also means “buonanotte”, which is marked wrong. Fix: Replace “buonanotte” with a form that is wrong for “boa noite”.",
      },
    ),
  },
  {
    expected: { gone: "Puedes", item: { field: "distractors", index: 1, list: "sentences" } },
    id: "en-es-slowly-informal-tile-also-right",
    userInput: toInput(
      plantSlip(spanishSlowly, (lesson) => ({
        ...lesson,
        sentences: patchAt(lesson.sentences, 1, { distractors: ["Puedes", "rápido"] }),
      })),
      {
        screen: 9,
        text: "“Can you speak more slowly, please?” doesn't say whom the learner addresses, so “¿Puedes hablar más despacio, por favor?”, built with the tile “Puedes”, is also right but marked wrong. Fix: Replace the tile “Puedes”.",
      },
    ),
  },
  {
    expected: { gone: "OH-trah VEHS", item: { field: "pronunciation", index: 2, list: "words" } },
    id: "en-es-slowly-respelling-contradicts-tip",
    userInput: toInput(
      plantSlip(spanishSlowly, (lesson) => ({
        ...lesson,
        words: patchAt(lesson.words, 2, { pronunciation: "OH-trah VEHS" }),
      })),
      {
        screen: 2,
        text: "The respelling “OH-trah VEHS” starts “vez” with an English v, while the tip says to say it like a soft b. Fix: “OH-trah BEHS”.",
      },
    ),
  },
  {
    expected: { kept: "FRÊD-do" },
    id: "pt-it-past-weather-wrong-finding-on-closed-e",
    userInput: toInput(italianPastWeather, {
      screen: 1,
      text: "The respelling “FRÊD-do” teaches a closed e, but the e of “freddo” is open. Fix: “FRÉD-do”.",
    }),
  },
];
