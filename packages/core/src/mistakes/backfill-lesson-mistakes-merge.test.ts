import { randomUUID } from "node:crypto";
import { prisma, sql } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { backfillLessonMistakes } from "../../scripts/_utils/backfill-lesson-mistakes";
import { mergeSkillForAdmin } from "../library/skills/merge-skill";
import { getSession } from "../users/get-session";

const GATE_NAMESPACE = 1_731_209;

describe("backfill attribution during skill merges", () => {
  it("serializes a merge started between recovery's read and write, then confirms the surviving attribution", async () => {
    const [lesson, duplicate, survivor, user, admin] = await Promise.all([
      libraryLessonFixture(),
      skillFixture(),
      skillFixture(),
      userFixture(),
      userFixture({ role: "admin" }),
    ]);

    await lessonSkillFixture({ lessonId: lesson.id, skillId: duplicate.id });
    const step = await libraryStepFixture({ kind: "check", lessonId: lesson.id });
    const attempt = await attemptFixture({ stepId: step.id, userId: user.id });

    const mistake = await mistakeFixture({
      attemptId: attempt.id,
      stepId: step.id,
      userId: user.id,
    });

    vi.mocked(getSession).mockResolvedValue(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The admin boundary reads only the trusted identity and role.
      { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
    );

    /** A test-owned trigger pauses the real UPDATE after recovery has read the lesson links. */
    const trigger = `recovery_gate_${randomUUID().replaceAll("-", "")}`;

    await prisma.$executeRawUnsafe(`
    CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(${GATE_NAMESPACE}, hashtext('${step.id}'));
      RETURN NEW;
    END;
    $$
  `);

    await prisma.$executeRawUnsafe(`
    CREATE TRIGGER ${trigger} BEFORE UPDATE OF skill_id ON library_steps
    FOR EACH ROW WHEN (OLD.id = '${step.id}' AND OLD.skill_id IS NULL)
    EXECUTE FUNCTION ${trigger}()
  `);

    const locked = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    const gate = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        sql`SELECT pg_advisory_xact_lock(${GATE_NAMESPACE}::int, hashtext(${step.id}))::text`,
      );

      locked.resolve(null);

      await release.promise;
    });

    await locked.promise;
    const scope = { dryRun: false, lessonIds: [lesson.id], userIds: [user.id] };
    const recovery = backfillLessonMistakes(scope);

    try {
      await expect
        .poll(async () => {
          const waiters = await prisma.$queryRaw<{ pid: number }[]>(sql`
          SELECT pid FROM pg_locks
          WHERE locktype = 'advisory' AND NOT granted
            AND classid = ${GATE_NAMESPACE}::oid AND objid = hashtext(${step.id})::oid
        `);

          return waiters.length;
        })
        .toBe(1);

      const merge = mergeSkillForAdmin({ duplicateId: duplicate.id, survivorId: survivor.id });

      try {
        /** Before the fix the merge commits here; afterward it must wait for recovery's lock. */
        await expect
          .poll(async () => {
            const merged = await prisma.skill.findUniqueOrThrow({ where: { id: duplicate.id } });

            const waiters = await prisma.$queryRaw<{ pid: number }[]>(sql`
            SELECT waiting.pid FROM pg_locks waiting
            JOIN pg_locks held USING (locktype, database, classid, objid, objsubid)
            WHERE waiting.locktype = 'advisory' AND waiting.mode = 'ShareLock'
              AND NOT waiting.granted AND held.granted
              AND held.pid IN (
                SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
                  AND classid = ${GATE_NAMESPACE}::oid AND objid = hashtext(${step.id})::oid
              )
          `);

            return merged.mergedIntoId === survivor.id || waiters.length > 0;
          })
          .toBe(true);
      } finally {
        release.resolve(null);
        await Promise.all([gate, recovery, merge]);
      }

      await expect(merge).resolves.toMatchObject({ status: "merged", survivorId: survivor.id });

      const [recoveredStep, recoveredAttempt, recoveredMistake, links] = await Promise.all([
        prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
        prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } }),
        prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
        prisma.lessonSkill.findMany({ where: { lessonId: lesson.id } }),
      ]);

      expect(links).toMatchObject([{ skillId: survivor.id }]);

      expect(recoveredStep.skillId).toBe(survivor.id);
      expect(recoveredAttempt.skillId).toBe(survivor.id);

      expect(recoveredMistake).toMatchObject({
        skillId: survivor.id,
        snapshot: mistake.snapshot,
        status: mistake.status,
      });

      await expect(backfillLessonMistakes(scope)).resolves.toMatchObject({
        attempts: { recoverable: 0, repaired: 0 },
        mistakes: { recoverable: 0, repaired: 0 },
        steps: { recoverable: 0, repaired: 0 },
      });
    } finally {
      release.resolve(null);
      await Promise.allSettled([gate, recovery]);
      await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON library_steps`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);
    }
  });
});
