import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { judgePicture } from "@zoonk/ai/tasks/lesson-spec/picture-need";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";

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
  const teaches = await judgePicture({
    analytics,
    lesson: picture.lessonTitle,
    novice,
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
  const decorative = new Set(
    judged.filter((item) => !item.teaches).map((item) => `${item.lesson}:${item.screen}`),
  );

  return specs.map((spec, lesson) => ({
    ...spec,
    screens: spec.screens.map((screen, index) =>
      decorative.has(`${lesson}:${index}`) ? { ...screen, visual: null } : screen,
    ),
  }));
}
