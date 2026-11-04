import { MAX_IMAGE_ALT_LENGTH, MAX_IMAGE_PROMPT_LENGTH } from "@zoonk/ai/tasks/images/request";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { findSharedPicture, isTeachingScreen } from "@zoonk/ai/tasks/lesson-spec/visuals";
import { shortenAtWord } from "@zoonk/ai/tasks/lesson-writer/bounds";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { findMarkdownTables } from "@zoonk/utils/markdown-table";
import { repairNegativeMoney } from "@zoonk/utils/negative-money";
import { repairMarkdown } from "@zoonk/utils/text-repairs";
import { dropEquivalentOptions } from "../_utils/option-checks";
import { checkWrittenExplore } from "../steps/written-screens";
import { getScreenTexts, mapActivityProse, mapScreenTexts } from "./_utils/screen-texts";

const MIN_OPTIONS = 2;

function repairScreenText(screen: WrittenScreen): WrittenScreen {
  if (screen.kind === "activity") {
    return {
      ...screen,
      content: mapActivityProse(screen.content, (text) => repairNegativeMoney({ text })),
    };
  }

  return mapScreenTexts(screen, ({ layout, text }) =>
    layout ? repairNegativeMoney({ text: repairMarkdown({ layout, text }) }) : text,
  );
}

/** A quote must match its screen's repaired sentence character for character. */
function repairBasisQuote(screen: WrittenScreen): WrittenScreen {
  if (screen.kind !== "check" && screen.kind !== "mathCheck" && screen.kind !== "typedAnswer") {
    return screen;
  }

  return screen.basis
    ? {
        ...screen,
        basis: {
          ...screen.basis,
          quote: repairNegativeMoney({
            text: repairMarkdown({ layout: "inline", text: screen.basis.quote }),
          }),
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
  const screens = lesson.screens.map((screen) =>
    repairOptions({ language, screen: repairBasisQuote(repairScreenText(screen)) }),
  );

  return {
    ...lesson,
    screens: repeatSharedPictures({ screens, spec }),
    summary: {
      ...lesson.summary,
      ideas: lesson.summary.ideas.map((idea) => ({
        ...idea,
        text: repairNegativeMoney({ text: repairMarkdown({ layout: "inline", text: idea.text }) }),
      })),
    },
  };
}

type TeachingScreen = Extract<WrittenScreen, { kind: "explanation" | "workedExample" }>;

function showsNothing(screen: TeachingScreen): boolean {
  const tables = getScreenTexts(screen).flatMap((piece) => findMarkdownTables(piece.text));
  const explore = screen.kind === "explanation" ? screen.explore : null;

  return (
    screen.image === null &&
    screen.visual === null &&
    tables.length === 0 &&
    !(explore && checkWrittenExplore(explore).ok)
  );
}

/**
 * A shared lesson's teaching screen still missing its planned visual after the fix pass gets a
 * picture of what its plan describes, as a bare plan screen does, so the lesson publishes with a
 * visual on every step instead of being held back and, after repeated drafts, set aside unwritten.
 */
export function pictureBareTeachingScreens({
  lesson,
  spec,
}: {
  lesson: WrittenLesson;
  spec: LessonSpec;
}): WrittenLesson {
  const screens = lesson.screens.map((screen, index) => {
    const specScreen = spec.screens[index];

    const teaching = screen.kind === "explanation" || screen.kind === "workedExample";

    const planned =
      specScreen && isTeachingScreen(specScreen.kind) && specScreen.visualKind !== "none";

    if (!specScreen || !planned || !teaching || !showsNothing(screen)) {
      return screen;
    }

    const described = specScreen.visual ?? specScreen.brief;

    const image = {
      alt: shortenAtWord(described, MAX_IMAGE_ALT_LENGTH),
      prompt: shortenAtWord(described, MAX_IMAGE_PROMPT_LENGTH),
    };

    return screen.kind === "explanation"
      ? { ...screen, explore: null, image }
      : { ...screen, image };
  });

  return { ...lesson, screens };
}
