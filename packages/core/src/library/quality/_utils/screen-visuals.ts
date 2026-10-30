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

const OPTION_LABEL = /^(?:\p{L}+ )?(?<label>\d)(?=$|:| \()/u;

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
  const unnamedLabels = allowImage ? findLabelsMissingFromAlt(screen) : [];

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
    ...(unnamedLabels.length > 0
      ? [
          `Its options name ${unnamedLabels.join(", ")} on the picture, but the picture's \`alt\` never says what is there. Learners who can't see the picture answer from the alt: say what each label shows, without naming what the question asks them to recognize.`,
        ]
      : []),
  ];
}

/**
 * Options name a numbered picture's numbers or the drawings 1 and 2 it compares ("1", "Scene 2",
 * "Drawing 1: …"); other numbers in options are answers, such as a count.
 */
function findLabelsMissingFromAlt(screen: WrittenScreen): string[] {
  if ((screen.kind !== "check" && screen.kind !== "hookGuess") || !screen.image) {
    return [];
  }

  const { image } = screen;

  const labels = new Set(
    screen.options.flatMap((option) => OPTION_LABEL.exec(option.text.trim())?.groups?.label ?? []),
  );

  const numbered = "parts" in image && image.parts !== null;
  const compared = labels.size === 2 && labels.has("1") && labels.has("2");

  if (!numbered && !compared) {
    return [];
  }

  return [...labels].filter((label) => !new RegExp(`(?<!\\d)${label}(?!\\d)`, "u").test(image.alt));
}
