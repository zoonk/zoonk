import { type VisualFloor } from "../_utils/visual-floor";
import { type LessonScreen, type LessonScreenKind, type LessonSpec } from "./lesson-spec-rules";

/**
 * A picture is described in `visual`; a table, a chart or a timeline is drawn by the app from the
 * brief's data; a template is the explanation's `activityTemplate`.
 */
export const LESSON_VISUAL_KINDS = [
  "picture",
  "table",
  "chart",
  "timeline",
  "template",
  "none",
] as const;

export type LessonVisualKind = (typeof LESSON_VISUAL_KINDS)[number];

const DRAWN_VISUAL_KINDS: ReadonlySet<LessonVisualKind> = new Set([
  "table",
  "chart",
  "timeline",
  "template",
]);

export function isTeachingScreen(kind: LessonScreenKind): boolean {
  return kind === "explanation" || kind === "workedExample";
}

/**
 * Every teaching screen of a shared lesson shows a visual. A private lesson serves one learner, so
 * to keep its cost down one in two shows one, and only what the app draws counts.
 */
const TEACHING_SCREENS_PER_VISUAL: Record<Exclude<VisualFloor, "none">, number> = {
  drawn: 2,
  pictures: 1,
};

function countsTowardFloor({
  screen,
  visualFloor,
}: {
  screen: LessonScreen;
  visualFloor: VisualFloor;
}): boolean {
  return visualFloor === "drawn"
    ? DRAWN_VISUAL_KINDS.has(screen.visualKind)
    : screen.visualKind !== "none";
}

export function getTeachingVisualShortfall({
  screens,
  visualFloor,
}: {
  screens: readonly LessonScreen[];
  visualFloor: VisualFloor;
}): number {
  if (visualFloor === "none") {
    return 0;
  }

  const teaching = screens.filter((screen) => isTeachingScreen(screen.kind));
  const shown = teaching.filter((screen) => countsTowardFloor({ screen, visualFloor })).length;
  const needed = Math.ceil(teaching.length / TEACHING_SCREENS_PER_VISUAL[visualFloor]);

  return Math.max(0, needed - shown);
}

function getTeachingVisualIssue({
  screens,
  visualFloor,
}: {
  screens: readonly LessonScreen[];
  visualFloor: VisualFloor;
}) {
  const missing = getTeachingVisualShortfall({ screens, visualFloor });

  const detail =
    visualFloor === "drawn"
      ? `${missing} more explanations or worked examples need a table, a chart, a timeline or a template: one in two shows one.`
      : `${missing} explanations or worked examples show nothing: every one shows the visual that teaches its idea best.`;

  return missing > 0 && { code: "teachingVisual" as const, detail };
}

/** The scene's visual is set in code (`normalizeLessonSpec`), so it's never missing. */
export function getVisualFloorIssues({
  screens,
  visualFloor,
}: {
  screens: readonly LessonScreen[];
  visualFloor: VisualFloor;
}) {
  return [getTeachingVisualIssue({ screens, visualFloor })].filter((issue) => issue !== false);
}

/**
 * A picture planned word for word like the screen before's is that same picture, shown again while
 * the next screens explain more of it: the index of the screen that first shows it, or null.
 */
export function findSharedPicture(screens: readonly LessonScreen[], index: number): number | null {
  const screen = screens[index];
  const previous = screens[index - 1];

  if (
    screen?.visualKind !== "picture" ||
    previous?.visualKind !== "picture" ||
    screen.visual !== previous.visual
  ) {
    return null;
  }

  return findSharedPicture(screens, index - 1) ?? index - 1;
}

/**
 * Every lesson opens on a scene the learner sees: one planned or saved with nothing shows its
 * moment in a picture of its brief.
 */
export function withSceneVisual(screen: LessonScreen): LessonScreen {
  return screen.kind === "hook" && screen.visualKind === "none"
    ? { ...screen, activityTemplate: null, visual: screen.brief, visualKind: "picture" }
    : screen;
}

/**
 * Teaching screens a plan still leaves bare after planning again get a visual: in a shared lesson a
 * picture of what the screen describes, which the picture judge turns into a table when a picture
 * wouldn't teach; in a private lesson a table, as far as its floor needs.
 */
export function fillTeachingVisuals({
  spec,
  visualFloor,
}: {
  spec: LessonSpec;
  visualFloor: VisualFloor;
}): LessonSpec {
  const missing = getTeachingVisualShortfall({ screens: spec.screens, visualFloor });

  const bare = spec.screens.flatMap((screen, index) =>
    isTeachingScreen(screen.kind) && screen.visualKind === "none" ? [index] : [],
  );

  const filled = new Set(bare.slice(0, missing));

  return filled.size === 0
    ? spec
    : {
        ...spec,
        screens: spec.screens.map((screen, index) => {
          if (!filled.has(index)) {
            return screen;
          }

          return visualFloor === "pictures"
            ? { ...screen, visual: screen.brief, visualKind: "picture" as const }
            : { ...screen, visualKind: "table" as const };
        }),
      };
}
