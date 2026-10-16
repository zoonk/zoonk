import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { waitForBlockedStatement } from "../../_test-utils/learner-revision";
import { lockSourceRoots } from "./plan-source-publication";

type Roots = Parameters<typeof lockSourceRoots>[1];

/** Holds a content write's source locks open until `release`, as a writer between its locks and commit. */
function holdSourceRoots(roots: Roots) {
  const held = Promise.withResolvers<number>();
  const released = Promise.withResolvers<null>();

  const done = prisma.$transaction(async (tx) => {
    await lockSourceRoots(tx, roots);
    const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    held.resolve(backend?.pid ?? 0);
    await released.promise;
  });

  done.catch((error: unknown) => held.reject(error));

  return { done, pid: held.promise, release: () => released.resolve(null) };
}

describe(lockSourceRoots, () => {
  it("makes a reader's share lock on the lessons and skills wait until the write commits", async () => {
    const [lesson, skill] = await Promise.all([libraryLessonFixture(), skillFixture()]);
    const holder = holdSourceRoots({ lessonIds: [lesson.id], skillIds: [skill.id] });
    const pid = await holder.pid;
    const read: string[] = [];

    const lessonRead = prisma.$queryRaw`
      SELECT id FROM library_lessons WHERE id = ${lesson.id}::uuid FOR SHARE
    `.then(() => read.push("lesson"));

    const skillRead = prisma.$queryRaw`
      SELECT id FROM skills WHERE id = ${skill.id}::uuid FOR SHARE
    `.then(() => read.push("skill"));

    try {
      await waitForBlockedStatement(pid, /FOR SHARE/u, 2);
      expect(read).toStrictEqual([]);
    } finally {
      holder.release();
      await Promise.all([holder.done, lessonRead, skillRead]);
    }

    expect(read.toSorted()).toStrictEqual(["lesson", "skill"]);
  });

  it("lets rows that only reference a locked skill insert meanwhile", async () => {
    const skill = await skillFixture();
    const holder = holdSourceRoots({ lessonIds: [], skillIds: [skill.id] });
    await holder.pid;

    try {
      await expect(itemFixture({ skillId: skill.id })).resolves.toMatchObject({
        skillId: skill.id,
      });
    } finally {
      holder.release();
      await holder.done;
    }
  });

  it("locks the lessons before the skills", async () => {
    const [lesson, skill] = await Promise.all([libraryLessonFixture(), skillFixture()]);
    const reader = holdSkillShare(skill.id);
    const readerPid = await reader.pid;

    const writer = prisma.$transaction((tx) =>
      lockSourceRoots(tx, { lessonIds: [lesson.id], skillIds: [skill.id] }),
    );

    try {
      // The writer waits on the skill, so it already holds the lesson.
      await waitForBlockedStatement(readerPid, /FROM skills/u);

      await expect(
        prisma.$queryRaw`SELECT id FROM library_lessons WHERE id = ${lesson.id}::uuid FOR SHARE NOWAIT`,
      ).rejects.toThrow();
    } finally {
      reader.release();
      await Promise.all([reader.done, writer]);
    }
  });
});

/** A reader holding a share lock on one skill, as a plan's source barrier does while it reads. */
function holdSkillShare(skillId: string) {
  const held = Promise.withResolvers<number>();
  const released = Promise.withResolvers<null>();

  const done = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM skills WHERE id = ${skillId}::uuid FOR SHARE`;
    const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    held.resolve(backend?.pid ?? 0);
    await released.promise;
  });

  done.catch((error: unknown) => held.reject(error));

  return { done, pid: held.promise, release: () => released.resolve(null) };
}
