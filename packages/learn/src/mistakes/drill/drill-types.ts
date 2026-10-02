import { type StudyQuestion } from "../../session/session-types";

/**
 * How a saved mistake's drill plays, by its cause: in "Practice mistakes" and in today's practice.
 * Core serves the same shape to both.
 */
export type Drill = NonNullable<StudyQuestion["drill"]>;

/** Where the host opens a lesson, so a content-gap drill can link its idea back. */
export type LessonHref = (lessonId: string) => string;

/**
 * A content gap brings the idea back before the questions: a screen of its own when the drill has
 * the lesson to show.
 */
export function isIdeaFirst(drill: Drill | null): boolean {
  return drill?.kind === "reteach" && drill.lesson !== null;
}

/** A misread is drilled by reading the whole question before the answers show. */
export function isReadFirst(drill: Drill | null): boolean {
  return drill?.kind === "readCarefully";
}
