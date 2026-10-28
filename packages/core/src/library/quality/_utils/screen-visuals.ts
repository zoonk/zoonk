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

  return getVisualProblems({
    canShowImage: screen.kind !== "typedAnswer",
    language,
    shown: {
      explores,
      hasImage: allowImage && image !== null,
      texts: getScreenTexts(screen).map((piece) => piece.text),
      visual: screen.visual,
    },
  });
}
