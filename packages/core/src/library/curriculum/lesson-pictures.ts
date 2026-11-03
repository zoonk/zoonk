import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { judgePicture } from "@zoonk/ai/tasks/lesson-spec/picture-need";
import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import {
  findSharedPicture,
  getTeachingVisualShortfall,
  isTeachingScreen,
} from "@zoonk/ai/tasks/lesson-spec/visuals";
import { type VisualFloor } from "@zoonk/ai/tasks/visual-floor";

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
 * Native visuals (tables, charts, timelines) aren't pictures and stay as planned, and so does the
 * scene's picture: every lesson opens on its story's moment. A picture shown again on the next
 * screens is judged once, on the screen that first shows it.
 */
export function listPlannedPictures({ specs }: { specs: readonly LessonSpec[] }): PlannedPicture[] {
  return specs.flatMap((spec, lesson) =>
    spec.screens.flatMap((screen, index) =>
      screen.visual && screen.kind !== "hook" && findSharedPicture(spec.screens, index) === null
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

/**
 * A dropped picture the visual floor needs becomes a table the app draws from the screen's brief,
 * so the floor never falls to nothing, teaching screens in order.
 */
function keepFloor({
  dropped,
  screens,
  visualFloor,
}: {
  dropped: ReadonlySet<number>;
  screens: readonly LessonScreen[];
  visualFloor: VisualFloor;
}): LessonScreen[] {
  const bare = screens.map((screen, index) =>
    dropped.has(index) ? { ...screen, visual: null, visualKind: "none" as const } : screen,
  );

  const missing = getTeachingVisualShortfall({ screens: bare, visualFloor });

  const drawn = new Set(
    [...dropped]
      .filter((index) => bare[index] && isTeachingScreen(bare[index].kind))
      .toSorted((left, right) => left - right)
      .slice(0, missing),
  );

  return bare.map((screen, index) =>
    drawn.has(index) ? { ...screen, visualKind: "table" as const } : screen,
  );
}

export function dropDecorativePictures({
  judged,
  specs,
  visualFloor,
}: {
  judged: readonly JudgedPicture[];
  specs: readonly LessonSpec[];
  visualFloor: VisualFloor;
}): LessonSpec[] {
  return specs.map((spec, lesson) => {
    const judgedDropped = new Set(
      judged.filter((item) => item.lesson === lesson && !item.teaches).map((item) => item.screen),
    );

    const dropped = new Set(
      spec.screens.flatMap((_, index) => {
        const first = findSharedPicture(spec.screens, index) ?? index;
        return judgedDropped.has(first) ? [index] : [];
      }),
    );

    return dropped.size === 0
      ? spec
      : { ...spec, screens: keepFloor({ dropped, screens: spec.screens, visualFloor }) };
  });
}
