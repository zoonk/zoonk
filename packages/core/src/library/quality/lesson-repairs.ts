import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { repairMarkdown } from "@zoonk/utils/text-repairs";
import { dropEquivalentOptions } from "../_utils/option-checks";
import { mapScreenTexts } from "./_utils/screen-texts";

/** Fewer options than this aren't a question, so twins stay for the fix pass to rewrite. */
const MIN_OPTIONS = 2;

function repairScreenMarkdown(screen: WrittenScreen): WrittenScreen {
  return mapScreenTexts(screen, ({ layout, text }) =>
    layout ? repairMarkdown({ layout, text }) : text,
  );
}

/** The options left after twins go, or all of them when too few would be left. */
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

/**
 * What code repairs in a written lesson before its checks run, so no fix pass is spent on it:
 * Markdown a learner would see as marks, taken out by how each text shows (`repairMarkdown`), and
 * an option that says what another one says, dropped while two or more stay (of twins, the right
 * one stays). Em dashes go when its screens are stored (`normalizeStepContentValue`). What code
 * can't repair is left for the checks to report.
 */
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
      repairOptions({ language, screen: repairScreenMarkdown(screen) }),
    ),
    summary: lesson.summary.map((idea) => repairMarkdown({ layout: "inline", text: idea })),
  };
}
