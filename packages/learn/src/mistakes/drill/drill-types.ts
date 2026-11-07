import { type StudyQuestion } from "../../session/session-types";

export type Drill = NonNullable<StudyQuestion["drill"]>;

export type LessonHref = (lessonId: string) => string;

/** A blank answer can come from any of them: Leave blank with Check, the not-sure button, or the clock. */
export type AnswerSender = "check" | "notSure" | "timer";

export function pressesCheck(sender: AnswerSender): boolean {
  return sender === "check" || sender === "timer";
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
