import { type StudyQuestion } from "../../session/session-types";

export type Drill = NonNullable<StudyQuestion["drill"]>;

export type LessonHref = (lessonId: string) => string;

/** A blank answer can come from any of them: Leave blank with Check, the not-sure button, or the clock. */
export type AnswerSender = "check" | "notSure" | "timer";

export function pressesCheck(sender: AnswerSender): boolean {
  return sender === "check" || sender === "timer";
}

/**
 * An answer sent again unchanged after it failed to save keeps the time it first took: a timed
 * drill grades that time, and the wait on the failure isn't the learner's.
 */
export function getSentDurationMs<Answer>({
  answer,
  failed,
  measuredMs,
}: {
  answer: Answer;
  failed: { answer: Answer; durationMs: number } | null;
  measuredMs: number;
}): number {
  return failed && JSON.stringify(failed.answer) === JSON.stringify(answer)
    ? failed.durationMs
    : measuredMs;
}

function getDrillIdeas(drill: Drill | null): string[] {
  return drill?.kind === "reteach" ? (drill.lesson?.ideas ?? []) : [];
}

export function isIdeaFirst(drill: Drill | null): boolean {
  return getDrillIdeas(drill).length > 0;
}

export function isReadFirst(drill: Drill | null): boolean {
  return drill?.kind === "readCarefully";
}
