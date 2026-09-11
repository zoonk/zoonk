import { prisma, sql } from "@zoonk/db";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { saveEditionRequest } from "./_utils/edition-request";
import { getCourseEditionForPrompt } from "./course-edition-link";

describe("course edition transaction coordination", () => {
  it("does not hold the global family lock during ordinary course initialization", async () => {
    const prompt = await coursePromptFixture();

    await prisma.$transaction(async (transaction) => {
      await expect(
        getCourseEditionForPrompt({ coursePromptId: prompt.id, transaction }),
      ).resolves.toBeNull();

      const locks = await transaction.$queryRaw<{ held: boolean }[]>(sql`
        SELECT EXISTS (
          SELECT FROM pg_locks
          WHERE pid = pg_backend_pid() AND locktype = 'advisory'
            AND classid = 92741 AND objid = 1 AND granted
        ) AS held
      `);

      expect(locks[0]?.held).toBe(false);
    });
  });

  it.each(["unlinked", "linked"])(
    "reconciles a %s prompt completing while an edition request is saved",
    async (state) => {
      const organization = await aiOrganizationFixture();

      const [source, target] = await Promise.all([
        courseFixture({ isPublished: true, organizationId: organization.id }),
        courseFixture({
          generationStatus: "completed",
          isPublished: true,
          language: "pt",
          organizationId: organization.id,
        }),
      ]);

      const prompt = await coursePromptFixture({
        courseId: state === "linked" ? target.id : null,
        language: "pt",
      });

      const locked = Promise.withResolvers<null>();

      const [, result] = await Promise.all([
        prisma.$transaction(async (transaction) => {
          // Existing-course claims lock the course before updating their prompt.
          // An unlinked prompt models initialization publishing its first target.
          if (state === "linked") {
            await transaction.$queryRaw(sql`
            SELECT id FROM courses WHERE id = ${target.id}::uuid FOR UPDATE
          `);
          } else {
            await transaction.$queryRaw(sql`
            SELECT id FROM course_prompts WHERE id = ${prompt.id}::uuid FOR UPDATE
          `);
          }

          const backend = await transaction.$queryRaw<{ pid: number }[]>(sql`
          SELECT pg_backend_pid() AS pid
        `);

          const pid = backend[0]?.pid;
          expect(pid).toBeDefined();
          locked.resolve(null);

          // Wait for the actual database conflict instead of scheduling with a sleep.
          await expect
            .poll(async () => {
              const waiters = await prisma.$queryRaw<{ waiting: boolean }[]>(sql`
            SELECT EXISTS (
              SELECT FROM pg_stat_activity
              WHERE ${pid}::int = ANY(pg_blocking_pids(pid))
            ) AS waiting
          `);

              return waiters[0]?.waiting;
            })
            .toBe(true);

          await transaction.coursePrompt.update({
            data: { courseId: target.id, generationStatus: "completed" },
            where: { id: prompt.id },
          });
        }),
        locked.promise.then(() =>
          saveEditionRequest({
            coursePromptId: prompt.id,
            language: "pt",
            sourceCourseId: source.id,
          }),
        ),
      ]);

      expect(result).toMatchObject({ course: { id: target.id }, kind: "course" });

      const [persistedSource, persistedTarget] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
        prisma.course.findUniqueOrThrow({ where: { id: target.id } }),
      ]);

      expect(persistedSource.familyId).toBeTruthy();
      expect(persistedTarget.familyId).toBe(persistedSource.familyId);
    },
  );
});
