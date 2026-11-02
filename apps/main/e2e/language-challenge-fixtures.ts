import { reachLanguageCheckpointFixture } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { createLanguageLearner } from "./language-learner";
import { saveMissions } from "./study-day";

export async function createLanguageChallenge({
  nextLessonTodo = false,
  plus = false,
}: {
  nextLessonTodo?: boolean;
  plus?: boolean;
}) {
  const learner = await createLanguageLearner({ withSubscription: plus });

  const [{ checkpoint: boss, nextItem, nextLesson }, session] = await Promise.all([
    reachLanguageCheckpointFixture({ ...learner, nextLessonTodo }),
    studySessionFixture({ goalId: learner.goal.id, userId: learner.user.id }),
  ]);

  const block = await studySessionBlockFixture({
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
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
  });

  const nextBlock = nextLessonTodo
    ? await studySessionBlockFixture({
        kind: "learn",
        lessonId: nextLesson.id,
        payload: { planItemId: nextItem.id, title: nextLesson.title },
        position: 1,
        sessionId: session.id,
      })
    : null;

  if (nextBlock) {
    await saveMissions(session.id, [
      { anchor: { blockKind: "learn" }, kind: "somethingNew", total: 1 },
    ]);
  }

  return { ...learner, block, boss, nextBlock, nextLesson };
}
