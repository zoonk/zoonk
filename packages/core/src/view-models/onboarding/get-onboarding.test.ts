import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getOnboarding } from "./get-onboarding";

async function readFirstLesson(goalId: string) {
  const result = await getOnboarding({ goalId });
  return result.status === "ready" ? result.onboarding.firstLesson : undefined;
}

describe(getOnboarding, () => {
  it("reads onboarding display without writing", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ details: { answered: [] }, userId: user.id });
    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getOnboarding({ goalId: goal.id }));
    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it("reports the goal's first lesson as writing until its run completes it", async () => {
    const user = await userFixture();

    const [writing, ready, setAside] = await Promise.all([
      libraryLessonFixture({ contentStatus: "running", title: "Why birds sing at dawn" }),
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentStatus: "failed", setAsideAt: new Date() }),
    ]);

    const [none, ...goals] = await Promise.all(
      [null, writing.id, ready.id, setAside.id].map((openingLessonId) =>
        goalFixture({ details: { answered: [] }, openingLessonId, userId: user.id }),
      ),
    );

    mockSession(user.id);

    await expect(readFirstLesson(none?.id ?? "")).resolves.toBeNull();

    await expect(Promise.all(goals.map((goal) => readFirstLesson(goal.id)))).resolves.toStrictEqual(
      [
        { id: writing.id, status: "writing", title: "Why birds sing at dawn" },
        { id: ready.id, status: "ready", title: ready.title },
        null,
      ],
    );
  });
});
