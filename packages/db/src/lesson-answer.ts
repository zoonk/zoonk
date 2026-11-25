import { type Attempt, Prisma } from "./generated/prisma/client";

export const LESSON_ANSWER_FILTER = { OR: [{ fromLesson: true }, { stepId: { not: null } }] };
export const NOT_LESSON_ANSWER_FILTER = { fromLesson: false, stepId: null };
export const NOT_LESSON_ANSWER_SQL = Prisma.sql`NOT from_lesson AND step_id IS NULL`;

export function isLessonAnswer({
  fromLesson,
  stepId,
}: Pick<Attempt, "fromLesson" | "stepId">): boolean {
  return fromLesson || stepId !== null;
}
