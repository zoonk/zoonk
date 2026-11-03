import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { createMoneyNotationRepair } from "@zoonk/utils/money-notation";
import { repairMarkdown } from "@zoonk/utils/text-repairs";
import { dropEquivalentOptions } from "../_utils/option-checks";
import {
  getActivityProse,
  getScreenTexts,
  mapActivityProse,
  mapScreenTexts,
} from "./_utils/screen-texts";

const MIN_OPTIONS = 2;

type TextRepair = (text: string) => string;

function readLessonTexts(lesson: WrittenLesson): string[] {
  return [
    ...lesson.screens.flatMap((screen) =>
      screen.kind === "activity"
        ? getActivityProse(screen.content)
        : getScreenTexts(screen).map(({ text }) => text),
    ),
    ...lesson.summary.ideas.map((idea) => idea.text),
  ];
}

function repairScreenText(screen: WrittenScreen, repairMoney: TextRepair): WrittenScreen {
  if (screen.kind === "activity") {
    return { ...screen, content: mapActivityProse(screen.content, repairMoney) };
  }

  return mapScreenTexts(screen, ({ layout, text }) =>
    layout ? repairMoney(repairMarkdown({ layout, text })) : text,
  );
}

/** A quote must match its screen's repaired sentence character for character. */
function repairBasisQuote(screen: WrittenScreen, repairMoney: TextRepair): WrittenScreen {
  if (screen.kind !== "check" && screen.kind !== "mathCheck" && screen.kind !== "typedAnswer") {
    return screen;
  }

  return screen.basis
    ? {
        ...screen,
        basis: {
          ...screen.basis,
          quote: repairMoney(repairMarkdown({ layout: "inline", text: screen.basis.quote })),
        },
      }
    : screen;
}

function keepDistinct<TOption extends { isCorrect: boolean; text: string }>({
  language,
  options,
}: {
  language: string;
  options: TOption[];
}): TOption[] {
  const distinct = dropEquivalentOptions({ language, options });
  return distinct.length >= MIN_OPTIONS ? distinct : options;
}

function repairOptions({
  language,
  screen,
}: {
  language: string;
  screen: WrittenScreen;
}): WrittenScreen {
  if (screen.kind === "check") {
    return { ...screen, options: keepDistinct({ language, options: screen.options }) };
  }

  if (screen.kind === "hookGuess") {
    return { ...screen, options: keepDistinct({ language, options: screen.options }) };
  }

  return screen;
}

export function repairWrittenLesson({
  language,
  lesson,
}: {
  language: string;
  lesson: WrittenLesson;
}): WrittenLesson {
  const repairMoney = createMoneyNotationRepair({ language, texts: readLessonTexts(lesson) });

  return {
    ...lesson,
    screens: lesson.screens.map((screen) =>
      repairOptions({
        language,
        screen: repairBasisQuote(repairScreenText(screen, repairMoney), repairMoney),
      }),
    ),
    summary: {
      ...lesson.summary,
      ideas: lesson.summary.ideas.map((idea) => ({
        ...idea,
        text: repairMoney(repairMarkdown({ layout: "inline", text: idea.text })),
      })),
    },
  };
}
