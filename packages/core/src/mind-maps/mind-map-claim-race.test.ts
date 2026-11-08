import { randomUUID } from "node:crypto";
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

/**
 * Holds `waiting`'s learner lock, so its request reads the map as available and then waits at its
 * claim while `meanwhile` runs.
 */
async function askHeldBack({
  meanwhile,
  waiting,
}: {
  meanwhile: () => Promise<void>;
  waiting: Parameters<typeof requestChapterMindMapFor>[0];
}) {
  const ready = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();

  const locking = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${waiting.userId}::uuid FOR UPDATE`;
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(connection!.pid);
      await release.promise;
    },
    { timeout: 12_000 },
  );

  void locking.catch(ready.reject);
  const pid = await ready.promise;
  const request = requestChapterMindMapFor(waiting);

  try {
    await expect
      .poll(
        () => prisma.$queryRaw<{ pid: number }[]>`
          SELECT pid FROM pg_stat_activity
          WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
        `,
        { interval: 10, timeout: 4000 },
      )
      .toHaveLength(1);

    await meanwhile();
  } finally {
    release.resolve(null);
    await locking;
  }

  return request;
}

async function writtenChapter() {
  const [chapter, lesson] = await Promise.all([
    libraryChapterFixture(),
    libraryLessonFixture({ contentStatus: "completed" }),
  ]);

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });

  return { chapterId: chapter.id, lessonId: lesson.id };
}

const STRUCTURE = {
  branches: ["Atom", "Nucleus", "Electron"].map((title) => ({
    drawing: title,
    explanation: `What ${title} means`,
    points: [title],
    title,
  })),
  centralIdea: "Matter is made of atoms",
  comparison: null,
  summary: "Atoms have a nucleus and electrons",
  title: "Atoms",
};

describe("a request that read the map as available, then waited at its claim", () => {
  it("joins the map another learner started meanwhile for free, even at its limit", async () => {
    const chapter = await writtenChapter();
    const [first, waiting] = await Promise.all([learnerOf(chapter), learnerOf(chapter)]);

    await prisma.usageRecord.createMany({
      data: [1, 2, 3].map(() => ({
        generated: true,
        kind: "mindMap" as const,
        targetId: randomUUID(),
        userId: waiting.userId,
      })),
    });

    const result = await askHeldBack({
      meanwhile: async () => {
        await expect(requestChapterMindMapFor(first)).resolves.toMatchObject({ status: "start" });
      },
      waiting,
    });

    expect(result.status).toBe("drawing");
    await expect(prisma.usageRecord.count({ where: { userId: waiting.userId } })).resolves.toBe(3);
  });

  it("finds the map another learner finished meanwhile ready, and neither charges nor redraws it", async () => {
    const chapter = await writtenChapter();
    const [first, waiting] = await Promise.all([learnerOf(chapter), learnerOf(chapter)]);

    const result = await askHeldBack({
      meanwhile: async () => {
        await expect(requestChapterMindMapFor(first)).resolves.toMatchObject({ status: "start" });

        await prisma.chapterMindMap.update({
          data: { status: "completed", structure: STRUCTURE },
          where: { chapterId: chapter.chapterId },
        });
      },
      waiting,
    });

    expect(result.status).toBe("ready");

    await expect(
      prisma.chapterMindMap.findUnique({
        select: { status: true },
        where: { chapterId: chapter.chapterId },
      }),
    ).resolves.toStrictEqual({ status: "completed" });

    await expect(prisma.usageRecord.count({ where: { userId: waiting.userId } })).resolves.toBe(0);
  });
});

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
