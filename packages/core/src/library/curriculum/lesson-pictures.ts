import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type PictureJudgment, judgePicture } from "@zoonk/ai/tasks/lesson-spec/picture-need";
import {
  type LessonScreen,
  type LessonSpec,
  countMissingTeachingVisuals,
} from "@zoonk/ai/tasks/lesson-spec/rules";

export type PlannedPicture = {
  lesson: number;
  screen: number;
  lessonTitle: string;
  picture: string;
  previousPicture: string | null;
  brief: string;
  kind: string;
};

export type JudgedPicture = Pick<PlannedPicture, "lesson" | "screen"> & PictureJudgment;

/**
 * Native visuals (tables, charts, timelines) aren't pictures and stay as planned, and so does a new
 * learner's hook picture: a beginner lesson always opens on its main example's picture.
 */
export function listPlannedPictures({
  novice,
  specs,
}: {
  novice: boolean;
  specs: readonly LessonSpec[];
}): PlannedPicture[] {
  return specs.flatMap((spec, lesson) =>
    spec.screens.flatMap((screen, index) =>
      screen.visual && !(novice && screen.kind === "hook")
        ? [
            {
              brief: screen.brief,
              kind: screen.kind,
              lesson,
              lessonTitle: spec.title,
              picture: screen.visual,
              previousPicture: spec.screens[index - 1]?.visual ?? null,
              screen: index,
            },
          ]
        : [],
    ),
  );
}

/** Internal workflow bridge: one model call, and it throws when the judge can't answer. */
export async function judgePlannedPicture({
  analytics,
  novice,
  picture,
}: {
  analytics?: AiGenerationContext;
  novice: boolean;
  picture: PlannedPicture;
}): Promise<JudgedPicture> {
  const judgment = await judgePicture({
    analytics,
    lesson: picture.lessonTitle,
    novice,
    picture: picture.picture,
    previousPicture: picture.previousPicture,
    screen: { brief: picture.brief, kind: picture.kind },
  });

  return { ...judgment, lesson: picture.lesson, screen: picture.screen };
}

function clearPictures({
  dropped,
  screens,
}: {
  dropped: readonly number[];
  screens: readonly LessonScreen[];
}): LessonScreen[] {
  return screens.map((screen, index) =>
    dropped.includes(index) ? { ...screen, visual: null } : screen,
  );
}

function countMissingAfter(input: {
  dropped: readonly number[];
  screens: readonly LessonScreen[];
}) {
  return countMissingTeachingVisuals(clearPictures(input));
}

/** Keeps, best-scored first, the decorative pictures a new learner's lesson needs for its floor. */
function keepVisualFloor({
  decorative,
  screens,
}: {
  decorative: readonly JudgedPicture[];
  screens: readonly LessonScreen[];
}): number[] {
  const dropped = decorative.map((picture) => picture.screen);
  const missing = countMissingAfter({ dropped, screens });

  const kept = new Set(
    decorative
      .filter(({ screen }) => {
        const restored = dropped.filter((index) => index !== screen);
        return countMissingAfter({ dropped: restored, screens }) < missing;
      })
      .toSorted((first, second) => second.probability - first.probability)
      .slice(0, missing)
      .map(({ screen }) => screen),
  );

  return dropped.filter((screen) => !kept.has(screen));
}

export function dropDecorativePictures({
  judged,
  novice,
  specs,
}: {
  judged: readonly JudgedPicture[];
  novice: boolean;
  specs: readonly LessonSpec[];
}): LessonSpec[] {
  return specs.map((spec, lesson) => {
    const decorative = judged.filter((picture) => picture.lesson === lesson && !picture.teaches);

    const dropped = novice
      ? keepVisualFloor({ decorative, screens: spec.screens })
      : decorative.map((picture) => picture.screen);

    return { ...spec, screens: clearPictures({ dropped, screens: spec.screens }) };
  });
}
