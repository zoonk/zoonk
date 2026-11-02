import { type StudyQuestion } from "../../session/session-types";

export type Drill = NonNullable<StudyQuestion["drill"]>;

export type LessonHref = (lessonId: string) => string;

function getDrillIdeas(drill: Drill | null): string[] {
  return drill?.kind === "reteach" ? (drill.lesson?.ideas ?? []) : [];
}

export function isIdeaFirst(drill: Drill | null): boolean {
  return getDrillIdeas(drill).length > 0;
}

export function isReadFirst(drill: Drill | null): boolean {
  return drill?.kind === "readCarefully";
}
