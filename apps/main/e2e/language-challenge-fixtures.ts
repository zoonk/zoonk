import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { createLanguageLearner } from "./language-learner";

/** A written unit call stays visible on both plans, while only Plus can play it. */
export async function createLanguageChallenge({
  final,
  nextLessonTodo = false,
  plus = false,
}: {
  final: boolean;
  nextLessonTodo?: boolean;
  plus?: boolean;
}) {
  const learner = await createLanguageLearner({ withSubscription: plus });
  const { arriving, goal, plan, renting, user } = learner;

  await Promise.all([
    prisma.goal.update({ data: { timezone: "UTC" }, where: { id: goal.id } }),
    prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } }),
    prisma.plan.update({
      data: {
        phases: [
          { name: arriving.title },
          { name: renting.title },
          ...(final ? [] : [{ name: "The next unit" }]),
        ],
      },
      where: { id: plan.id },
    }),
  ]);

  const [boss, session, next] = await Promise.all([
    planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    final
      ? null
      : playableLessonFixture({ lesson: { title: "The next unit's lesson" }, steps: ["check"] }),
  ]);

  const [block, nextItem] = await Promise.all([
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: {
        checkpoint: {
          kind: final ? "finalBoss" : "boss",
          mock: false,
          passMark: 0,
          phase: 1,
          rematch: false,
          timeLimitMinutes: null,
        },
        planItemId: boss.id,
      },
      position: 0,
      sessionId: session.id,
    }),
    next &&
      planItemFixture({
        kind: "lesson",
        lessonId: next.lesson.id,
        phase: 2,
        planId: plan.id,
        position: 11,
        status: nextLessonTodo ? "todo" : "done",
        titleSnapshot: next.lesson.title,
      }),
  ]);

  const nextBlock =
    nextLessonTodo && next && nextItem
      ? await studySessionBlockFixture({
          kind: "learn",
          lessonId: next.lesson.id,
          payload: { planItemId: nextItem.id, title: next.lesson.title },
          position: 1,
          sessionId: session.id,
        })
      : null;

  return { ...learner, block, boss, nextBlock, nextLesson: next?.lesson ?? null };
}
