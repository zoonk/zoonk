import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { repairMarkdown } from "@zoonk/utils/text-repairs";
import { dropEquivalentOptions } from "../_utils/option-checks";
import { mapScreenTexts } from "./_utils/screen-texts";

const MIN_OPTIONS = 2;

function repairScreenMarkdown(screen: WrittenScreen): WrittenScreen {
  return mapScreenTexts(screen, ({ layout, text }) =>
    layout ? repairMarkdown({ layout, text }) : text,
  );
}

function repairBasisQuote(screen: WrittenScreen): WrittenScreen {
  if (screen.kind !== "check" && screen.kind !== "mathCheck" && screen.kind !== "typedAnswer") {
    return screen;
  }

  return screen.basis
    ? {
        ...screen,
        basis: {
          ...screen.basis,
          quote: repairMarkdown({ layout: "inline", text: screen.basis.quote }),
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
  return {
    ...lesson,
    screens: lesson.screens.map((screen) =>
      repairOptions({ language, screen: repairBasisQuote(repairScreenMarkdown(screen)) }),
    ),
    summary: lesson.summary.map((idea) => repairMarkdown({ layout: "inline", text: idea })),
  };
}
