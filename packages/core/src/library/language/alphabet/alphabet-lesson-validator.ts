import { isDeepStrictEqual } from "node:util";
import {
  type PublishedAlphabetLesson,
  listAlphabetScreens,
  pickWholeLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { buildAlphabetLessonSteps } from "./alphabet-lesson-steps";

export type AlphabetCheck = { passed: boolean; problem: string };

type Letter = PublishedAlphabetLesson["letters"][number];

const LATIN_LETTER = /\p{Script=Latin}/u;
const MAX_FORMS = 4;
const JOINING_SCRIPTS = new Set(["Adlm", "Arab", "Mong", "Nkoo", "Syrc"]);
const FINAL_FORM_SCRIPTS = new Set(["Grek", "Hebr"]);

function comparable(text: string): string {
  return text.trim().normalize("NFC").toLowerCase();
}

function isScriptText(text: string): boolean {
  return text.trim().length > 0 && !LATIN_LETTER.test(text);
}

function showsItsSyllable(letter: Letter): boolean {
  return (
    comparable(letter.audioText) === comparable(letter.symbol) ||
    comparable(letter.pronunciation).includes(comparable(letter.audioText))
  );
}

function checkForms({
  letters,
  targetLanguage,
}: {
  letters: readonly Letter[];
  targetLanguage: string;
}): AlphabetCheck[] {
  const { script = "" } = new Intl.Locale(targetLanguage).maximize();
  const withForms = letters.some((letter) => letter.forms.length > 0);

  const scriptRule = JOINING_SCRIPTS.has(script)
    ? { passed: withForms, problem: "A connected script's letters have no joining forms." }
    : {
        passed: FINAL_FORM_SCRIPTS.has(script) || !withForms,
        problem: "Letters of a script without positional forms have forms.",
      };

  return [
    {
      passed: letters.every(
        (letter) =>
          letter.forms.length <= MAX_FORMS &&
          letter.forms.every((form) => form.label.trim() && isScriptText(form.symbol)),
      ),
      problem: `A letter has more than ${MAX_FORMS} forms, or a form without its label or symbol.`,
    },
    scriptRule,
  ];
}

function keepsEveryScreen(lesson: PublishedAlphabetLesson): boolean {
  const kinds = buildAlphabetLessonSteps({ audioUrls: new Map(), content: lesson }).map(
    (step) => step.kind,
  );

  const count = (kind: string) => kinds.filter((current) => current === kind).length;

  return (
    count("explanation") === lesson.intro.length &&
    count("alphabet") === lesson.letters.length &&
    count("summary") === 1
  );
}

export function checkAlphabetLesson({
  lesson,
  targetLanguage,
}: {
  lesson: PublishedAlphabetLesson;
  targetLanguage: string;
}): AlphabetCheck[] {
  const symbols = lesson.letters.map((letter) => letter.symbol.trim());

  return [
    { passed: new Set(symbols).size === symbols.length, problem: "Two letters share a symbol." },
    {
      passed: symbols.every((symbol) => isScriptText(symbol)),
      problem: "A symbol is empty or written in Latin letters.",
    },
    {
      passed: lesson.letters.every((letter) => LATIN_LETTER.test(letter.readingAid)),
      problem: "A letter's romanization has no Latin letters.",
    },
    {
      passed: lesson.letters.every((letter) => letter.audioText.trim().length > 0),
      problem: "A letter has no text for its audio.",
    },
    ...checkForms({ letters: lesson.letters, targetLanguage }),
    {
      passed: lesson.letters.every((letter) => showsItsSyllable(letter)),
      problem: "A card plays a syllable its sound cue never shows.",
    },
    {
      passed: keepsEveryScreen(lesson),
      problem: "A screen was lost when the lesson's steps were built.",
    },
  ];
}

/** A fix passes when it changed every part a problem names and the fixed lesson passes its checks. */
export function checkAlphabetFix({
  fixed,
  lesson,
  problems,
  targetLanguage,
}: {
  fixed: PublishedAlphabetLesson;
  lesson: PublishedAlphabetLesson;
  problems: readonly { screen: number | null }[];
  targetLanguage: string;
}): AlphabetCheck[] {
  const before = listAlphabetScreens(lesson);
  const after = listAlphabetScreens(fixed);

  return [
    ...problems.map(({ screen }) =>
      screen === null
        ? {
            passed: !isDeepStrictEqual(pickWholeLesson(lesson), pickWholeLesson(fixed)),
            problem: "The whole lesson wasn't changed.",
          }
        : {
            passed:
              after[screen] !== undefined && !isDeepStrictEqual(before[screen], after[screen]),
            problem: `Screen ${screen + 1} wasn't changed.`,
          },
    ),
    ...checkAlphabetLesson({ lesson: fixed, targetLanguage }),
  ];
}
