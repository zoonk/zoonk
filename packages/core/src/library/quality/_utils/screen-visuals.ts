import { type LessonScreen } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { getScreenTexts } from "./screen-texts";
import { getVisualProblems, pointsAtFigure } from "./visual-references";

/** Screens that can show a picture, so one the plan didn't ask for goes there when it's needed. */
const KINDS_WITH_PICTURES = new Set<WrittenScreen["kind"]>([
  "check",
  "explanation",
  "hookGuess",
  "hookText",
  "workedExample",
]);

/**
 * A picture goes where the plan asked for one, or on any screen whose words point at something to
 * see that the app can't draw from data (a scene, a diagram, a map, a pie chart): the screen shows
 * it instead of describing it or being asked to drop it.
 */
export function canHaveImage({
  language,
  screen,
  specScreen,
}: {
  language: string;
  screen: WrittenScreen;
  specScreen: LessonScreen;
}): boolean {
  if (specScreen.visual !== null) {
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

/**
 * A screen shows what its words point at: the picture, the Markdown table, the chart or the
 * timeline. Activities draw their own. `allowImage` says whether the screen's picture is kept.
 */
export function getScreenVisualProblems({
  allowImage,
  language,
  screen,
}: {
  allowImage: boolean;
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
      hasImage: allowImage && image !== null,
      texts: getScreenTexts(screen).map((piece) => piece.text),
      visual: screen.visual,
    },
  });
}
