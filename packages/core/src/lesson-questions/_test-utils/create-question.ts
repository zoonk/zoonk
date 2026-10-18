import { randomUUID } from "node:crypto";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../_test-utils/mock-session";
import { createLessonQuestion } from "../create-lesson-question";

type LessonSteps = NonNullable<Parameters<typeof playableLessonFixture>[0]>["steps"];

/** A signed-in learner who asked one question about a written Library lesson. */
export async function createLessonQuestionFixture({ steps }: { steps?: LessonSteps } = {}) {
  const [user, { lesson, steps: lessonSteps }] = await Promise.all([
    userFixture(),
    playableLessonFixture({ steps }),
  ]);

  mockSession(user.id);

  const created = await createLessonQuestion({
    input: {
      context: { kind: "lesson" },
      question: "How does this connect?",
      requestId: randomUUID(),
    },
    target: { kind: "lesson", lessonId: lesson.id },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  return { lesson, question: created.question, steps: lessonSteps, user };
}
