import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { findSharedPicture } from "@zoonk/ai/tasks/lesson-spec/visuals";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { wrapBareLatex } from "@zoonk/utils/bare-latex";
import { repairNegativeMoney } from "@zoonk/utils/negative-money";
import { type TextLayout } from "@zoonk/utils/text-flaws";
import { repairMarkdown } from "@zoonk/utils/text-repairs";
import { dropEquivalentOptions } from "../_utils/option-checks";
import { getScreenTexts, mapActivityProse, mapScreenTexts } from "./_utils/screen-texts";

const MIN_OPTIONS = 2;

/** Every text gets the same repairs, so a quote still matches the sentence it cites. */
function repairProse({ layout, text }: { layout: TextLayout; text: string }): string {
  return repairNegativeMoney({ text: repairMarkdown({ layout, text }) });
}

function repairText({ layout, text }: { layout: TextLayout; text: string }): string {
  return wrapBareLatex({ layout, text: repairProse({ layout, text }) });
}

export function repairScreenText(screen: WrittenScreen): WrittenScreen {
  if (screen.kind === "activity") {
    return {
      ...screen,
      content: mapActivityProse(screen.content, (text) =>
        wrapBareLatex({ layout: "blocks", text: repairNegativeMoney({ text }) }),
      ),
    };
  }

  return mapScreenTexts(screen, ({ layout, text }) =>
    layout ? repairText({ layout, text }) : text,
  );
}

/**
 * A quote must match its screen's repaired sentence character for character, and whether a power
 * there was wrapped depends on the rest of its line (a price can rule it out), so the quote follows
 * the screen it cites.
 */
function repairBasisQuote({
  screen,
  screens,
}: {
  screen: WrittenScreen;
  screens: readonly WrittenScreen[];
}): WrittenScreen {
  if (screen.kind !== "check" && screen.kind !== "mathCheck" && screen.kind !== "typedAnswer") {
    return screen;
  }

  if (!screen.basis) {
    return screen;
  }

  const quote = repairProse({ layout: "inline", text: screen.basis.quote });
  const wrapped = wrapBareLatex({ layout: "inline", text: quote });
  const cited = screens[screen.basis.screen - 1];

  const isWrapped = cited
    ? getScreenTexts(cited).some(({ text }) => text.includes(wrapped))
    : false;

  return { ...screen, basis: { ...screen.basis, quote: isWrapped ? wrapped : quote } };
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

type PictureRequest = { alt: string; prompt: string };

function getPicture(screen: WrittenScreen | undefined): PictureRequest | null {
  return screen && screen.kind !== "check" && "image" in screen ? screen.image : null;
}

/**
 * A screen planned to keep the picture the screens before it show gets that exact picture, so the
 * app draws it once and the learner sees the same one while the screens explain more of it.
 */
function repeatSharedPictures({
  screens,
  spec,
}: {
  screens: readonly WrittenScreen[];
  spec: LessonSpec;
}): WrittenScreen[] {
  return screens.map((screen, index) => {
    const first = findSharedPicture(spec.screens, index);
    const image = first === null ? null : getPicture(screens[first]);

    return image && screen.kind !== "check" && "image" in screen ? { ...screen, image } : screen;
  });
}

export function repairWrittenLesson({
  language,
  lesson,
  spec,
}: {
  language: string;
  lesson: WrittenLesson;
  spec: LessonSpec;
}): WrittenLesson {
  const repaired = lesson.screens.map((screen) => repairScreenText(screen));

  const screens = repaired.map((screen) =>
    repairOptions({ language, screen: repairBasisQuote({ screen, screens: repaired }) }),
  );

  return {
    ...lesson,
    screens: repeatSharedPictures({ screens, spec }),
    summary: {
      ...lesson.summary,
      ideas: lesson.summary.ideas.map((idea) => ({
        ...idea,
        text: repairText({ layout: "inline", text: idea.text }),
      })),
    },
  };
}
