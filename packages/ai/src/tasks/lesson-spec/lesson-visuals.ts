import { type VisualFloor } from "../_utils/visual-floor";
import { type LessonScreen, type LessonScreenKind } from "./lesson-spec-rules";

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

const TEACHING_SCREENS_PER_VISUAL = 3;

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
  const needed = Math.ceil(teaching.length / TEACHING_SCREENS_PER_VISUAL);

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
  const kinds = visualFloor === "drawn" ? "a table, a chart, a timeline or a template" : "a visual";

  return (
    missing > 0 && {
      code: "teachingVisual" as const,
      detail: `${missing} more explanations or worked examples need ${kinds}: one in three shows one.`,
    }
  );
}

/**
 * A floor, not a share to fill: the scene's visual and one in three teaching screens. A private
 * lesson's pictures serve one learner, so its floor counts only what the app draws.
 */
export function getVisualFloorIssues({
  screens,
  visualFloor,
}: {
  screens: readonly LessonScreen[];
  visualFloor: VisualFloor;
}) {
  if (visualFloor === "none") {
    return [];
  }

  return [
    screens[0]?.kind === "hook" &&
      screens[0].visualKind === "none" && {
        code: "hookVisual" as const,
        detail: "The scene shows nothing; it needs a picture of its moment or a table or chart.",
      },
    getTeachingVisualIssue({ screens, visualFloor }),
  ].filter((issue) => issue !== false);
}
