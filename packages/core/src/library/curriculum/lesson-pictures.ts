import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { judgePicture } from "@zoonk/ai/tasks/lesson-spec/picture-need";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
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
 * Native visuals (tables, charts, timelines) aren't pictures and stay as planned. A picture shown
 * again on the next screens is judged once, on the screen that first shows it.
 */
export function listPlannedPictures({ specs }: { specs: readonly LessonSpec[] }): PlannedPicture[] {
  return specs.flatMap((spec, lesson) =>
    spec.screens.flatMap((screen, index) =>
      screen.visual && findSharedPicture(spec.screens, index) === null
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
