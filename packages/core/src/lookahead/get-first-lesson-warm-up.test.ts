import { randomUUID } from "node:crypto";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { warmUpFixture } from "@zoonk/testing/fixtures/warm-ups";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getFirstLessonWarmUp } from "./get-first-lesson-warm-up";

describe(getFirstLessonWarmUp, () => {
  it("serves the goal's deck to its learner only until a lesson of the goal is finished", async () => {
    const [deck, user, stranger, lesson, finished] = await Promise.all([
      warmUpFixture(),
      userFixture(),
      userFixture(),
      libraryLessonFixture({ contentRunId: randomUUID(), contentStatus: "running" }),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    const goal = await goalFixture({ userId: user.id, warmUpId: deck.id });
    const plan = await planFixture({ goalId: goal.id });

    await Promise.all([
      planItemFixture({ lessonId: lesson.id, planId: plan.id, position: 0 }),
      planItemFixture({ lessonId: finished.id, planId: plan.id, position: 1 }),
    ]);

    mockSession(user.id);

    await expect(getFirstLessonWarmUp({ lessonId: lesson.id })).resolves.toMatchObject({
      id: deck.id,
    });

    mockSession(stranger.id);
    await expect(getFirstLessonWarmUp({ lessonId: lesson.id })).resolves.toBeNull();

    mockSession(null);
    await expect(getFirstLessonWarmUp({ lessonId: lesson.id })).resolves.toBeNull();

    await learningEventFixture({
      contentIds: { lessonId: finished.id },
      goalId: goal.id,
      lessonKind: "library",
      userId: user.id,
    });

    mockSession(user.id);
    await expect(getFirstLessonWarmUp({ lessonId: lesson.id })).resolves.toBeNull();
  });
});
