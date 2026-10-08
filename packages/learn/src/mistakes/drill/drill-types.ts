import { type StudyQuestion } from "../../session/session-types";

/**
 * How a saved mistake's drill plays, by its cause: in "Practice mistakes" and in today's practice.
 * Core serves the same shape to both.
 */
export type Drill = NonNullable<StudyQuestion["drill"]>;

/** Where the host opens a lesson, so a content-gap drill can link its idea back. */
export type LessonHref = (lessonId: string) => string;

/** The ideas of the lesson a content gap goes over, when it has a summary to show. */
function getDrillIdeas(drill: Drill | null): string[] {
  return drill?.kind === "reteach" ? (drill.lesson?.ideas ?? []) : [];
}

/**
 * A content gap brings the idea back before the questions: a screen of its own when the drill has
 * the lesson's ideas to show. A lesson without a summary only links back to the lesson.
 */
export function isIdeaFirst(drill: Drill | null): boolean {
  return getDrillIdeas(drill).length > 0;
}

/** A misread is drilled by reading the whole question before the answers show. */
export function isReadFirst(drill: Drill | null): boolean {
  return drill?.kind === "readCarefully";
}
