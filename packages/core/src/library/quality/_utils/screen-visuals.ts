import { type LessonScreen } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { getScreenTexts } from "./screen-texts";
import { getVisualProblems, pointsAtFigure } from "./visual-references";

const KINDS_WITH_PICTURES = new Set<WrittenScreen["kind"]>([
  "check",
  "explanation",
  "hookGuess",
  "hookText",
  "workedExample",
]);

const NUMBER_OPTION = /^\d$/u;

function asksAboutItsPictures(screen: WrittenScreen): boolean {
  return (
    screen.kind === "check" &&
    (Boolean(screen.image?.parts) || screen.options.some((option) => option.picture))
  );
}

export function canHaveImage({
  language,
  screen,
  specScreen,
}: {
  language: string;
  screen: WrittenScreen;
  specScreen: LessonScreen;
}): boolean {
  if (specScreen.visual !== null || asksAboutItsPictures(screen)) {
    return true;
  }

  if (!KINDS_WITH_PICTURES.has(screen.kind)) {
    return false;
  }

  const text = getScreenTexts(screen)
    .map((piece) => piece.text)
    .join("\n");

  return pointsAtFigure({ language, text });
}

export function getScreenVisualProblems({
  allowImage,
  explores,
  language,
  screen,
}: {
  allowImage: boolean;
  explores: boolean;
  language: string;
  screen: WrittenScreen;
}): string[] {
  if (screen.kind === "activity" || screen.kind === "mathCheck") {
    return [];
  }

  const image = "image" in screen ? screen.image : null;
  const unplacedNumbers = allowImage ? findNumbersMissingFromAlt(screen) : [];

  return [
    ...getVisualProblems({
      canShowImage: screen.kind !== "typedAnswer",
      language,
      shown: {
        explores,
        hasImage: allowImage && image !== null,
        texts: getScreenTexts(screen).map((piece) => piece.text),
        visual: screen.visual,
      },
    }),
    ...(unplacedNumbers.length > 0
      ? [
          `Its options name ${unplacedNumbers.join(", ")} on the numbered picture, but the picture's \`alt\` never says where they sit. Learners who can't see the picture answer from the alt: say where each number sits and how that spot looks, without naming the part.`,
        ]
      : []),
  ];
}

function findNumbersMissingFromAlt(screen: WrittenScreen): string[] {
  if (screen.kind !== "check" || !screen.image?.parts) {
    return [];
  }

  const { alt } = screen.image;

  return screen.options
    .map((option) => option.text.trim())
    .filter(
      (text) => NUMBER_OPTION.test(text) && !new RegExp(`(?<!\\d)${text}(?!\\d)`, "u").test(alt),
    );
}
