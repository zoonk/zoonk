import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { requestChapterMindMapFor } from "./request-chapter-mind-map";

async function learnerOf({ chapterId, lessonId }: { chapterId: string; lessonId: string }) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  await planItemFixture({ chapterId, lessonId, planId: plan.id, position: 0 });

  return { chapterId, goalId: goal.id, userId: user.id };
}

/** A real table lock holds both requests at their map claim, after each read the map as available. */
async function askTogether(asks: Parameters<typeof requestChapterMindMapFor>[0][]) {
  const ready = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();

  const locking = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`LOCK TABLE chapter_mind_maps IN SHARE MODE`;
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(connection!.pid);
      await release.promise;
    },
    { timeout: 12_000 },
  );

  void locking.catch(ready.reject);
  const pid = await ready.promise;
  const requests = Promise.all(asks.map((ask) => requestChapterMindMapFor(ask)));

  try {
    await expect
      .poll(
        () => prisma.$queryRaw<{ query: string }[]>`
          SELECT query FROM pg_stat_activity
          WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
            AND query ~* 'chapter_mind_maps'
        `,
        { interval: 10, timeout: 4000 },
      )
      .toHaveLength(asks.length);
  } finally {
    release.resolve(null);
    await locking;
  }

  return requests;
}

describe("two learners asking for the same new map at once", () => {
  it("charges only the learner whose request starts it; the other joins for free", async () => {
    const [chapter, lesson] = await Promise.all([libraryChapterFixture(), libraryLessonFixture()]);

    await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });

    const asks = await Promise.all([
      learnerOf({ chapterId: chapter.id, lessonId: lesson.id }),
      learnerOf({ chapterId: chapter.id, lessonId: lesson.id }),
    ]);

    const results = await askTogether(asks);

    expect(results.map((result) => result.status).toSorted()).toStrictEqual([
      "start",
      "writingLessons",
    ]);

    const charged = await Promise.all(
      asks.map(({ userId }) => prisma.usageRecord.count({ where: { userId } })),
    );

    expect(charged).toStrictEqual(results.map((result) => (result.status === "start" ? 2 : 0)));
  });
});
