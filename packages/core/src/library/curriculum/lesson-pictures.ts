import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { judgePicture } from "@zoonk/ai/tasks/lesson-spec/picture-need";
import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { findSharedPicture } from "@zoonk/ai/tasks/lesson-spec/visuals";

export type PlannedPicture = {
  lesson: number;
  screen: number;
  lessonTitle: string;
  picture: string;
  previousPicture: string | null;
  brief: string;
  kind: string;
};

export type JudgedPicture = Pick<PlannedPicture, "lesson" | "screen"> & { teaches: boolean };

/**
 * Where a picture shown on several screens in a row is judged: on the screen that first shows it,
 * unless that's the scene, which only sets up what the next screen explains with it.
 */
function findJudgedScreen(
  screens: readonly LessonScreen[],
  index: number,
): LessonScreen | undefined {
  const sharedWithNext = findSharedPicture(screens, index + 1) === index;
  return screens[screens[index]?.kind === "hook" && sharedWithNext ? index + 1 : index];
}

/**
 * Native visuals (tables, charts, timelines) aren't pictures and stay as planned. A picture shown
 * again on the next screens is judged once, and kept or dropped on all of them.
 */
export function listPlannedPictures({ specs }: { specs: readonly LessonSpec[] }): PlannedPicture[] {
  return specs.flatMap((spec, lesson) =>
    spec.screens.flatMap((screen, index) => {
      const judged = findJudgedScreen(spec.screens, index);

      return screen.visual && judged && findSharedPicture(spec.screens, index) === null
        ? [
            {
              brief: judged.brief,
              kind: judged.kind,
              lesson,
              lessonTitle: spec.title,
              picture: screen.visual,
              previousPicture: spec.screens[index - 1]?.visual ?? null,
              screen: index,
            },
          ]
        : [];
    }),
  );
}

/** Internal workflow bridge: one model call, and it throws when the judge can't answer. */
export async function judgePlannedPicture({
  analytics,
  picture,
}: {
  analytics?: AiGenerationContext;
  picture: PlannedPicture;
}): Promise<JudgedPicture> {
  const teaches = await judgePicture({
    analytics,
    lesson: picture.lessonTitle,
    picture: picture.picture,
    previousPicture: picture.previousPicture,
    screen: { brief: picture.brief, kind: picture.kind },
  });

  return { lesson: picture.lesson, screen: picture.screen, teaches };
}

export function dropDecorativePictures({
  judged,
  specs,
}: {
  judged: readonly JudgedPicture[];
  specs: readonly LessonSpec[];
}): LessonSpec[] {
  return specs.map((spec, lesson) => {
    const decorative = new Set(
      judged.filter((item) => item.lesson === lesson && !item.teaches).map((item) => item.screen),
    );

    return {
      ...spec,
      screens: spec.screens.map((screen, index) =>
        decorative.has(findSharedPicture(spec.screens, index) ?? index)
          ? { ...screen, visual: null, visualKind: "none" as const }
          : screen,
      ),
    };
  });
}
