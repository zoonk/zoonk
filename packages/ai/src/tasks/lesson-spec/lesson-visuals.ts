import { type LessonScreen } from "./lesson-spec-rules";

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
