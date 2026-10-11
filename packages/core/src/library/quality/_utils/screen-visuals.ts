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
 * A question asked about its pictures: options that are pictures, or a picture whose numbers mark
 * the parts it asks about. Without them it can't be answered, so they're never dropped.
 */
function asksAboutItsPictures(screen: WrittenScreen): boolean {
  return (
    screen.kind === "check" &&
    (Boolean(screen.image?.parts) || screen.options.some((option) => option.picture))
  );
}

/**
 * A picture goes where the plan asked for one, on a question asked about its pictures, or on any
 * screen whose words point at something to see that the app can't draw from data (a scene, a
 * diagram, a map, a pie chart): the screen shows it instead of describing it or being asked to
 * drop it.
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

/**
 * A screen shows what its words point at: the picture, the Markdown table, the chart or the
 * timeline, or the template an explanation explores. Activities draw their own. `allowImage` says
 * whether the screen's picture is kept, and `explores` whether its explored template passed.
 */
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
