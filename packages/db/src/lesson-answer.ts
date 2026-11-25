import { type Attempt, Prisma } from "./generated/prisma/client";

export const LESSON_ANSWER_FILTER = { OR: [{ fromLesson: true }, { stepId: { not: null } }] };
export const NOT_LESSON_ANSWER_FILTER = {
  OR: [{ fromLesson: false }, { fromLesson: null }],
  stepId: null,
};
export const NOT_LESSON_ANSWER_SQL = Prisma.sql`from_lesson IS NOT TRUE AND step_id IS NULL`;

export function isLessonAnswer({
  fromLesson,
  stepId,
}: Pick<Attempt, "fromLesson" | "stepId">): boolean {
  return fromLesson === true || stepId !== null;
}
