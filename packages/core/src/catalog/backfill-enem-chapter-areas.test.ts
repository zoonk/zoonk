import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import {
  type EnemAreaScope,
  applyEnemAreaManifest,
  prepareEnemAreaManifest,
} from "../../../db/src/scripts/_enem-areas/manifest";

const TARGET = { database: "disposable-test-clone", host: "localhost", port: "5432" };

async function lineageFixture() {
  const [course, blueprint, math, science, orphan, agreed, mixed, unmapped] = await Promise.all([
    courseFixture({ isPublished: true, visibility: "public" }),
    examBlueprintFixture(),
    skillFixture(),
    skillFixture(),
    skillFixture(),
    libraryChapterFixture(),
    libraryChapterFixture(),
    libraryChapterFixture(),
  ]);

  await Promise.all([
    ...[agreed, mixed, unmapped].map((chapter, position) =>
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position }),
    ),
    ...[agreed, mixed, unmapped].map((chapter) =>
      chapterSkillFixture({ chapterId: chapter.id, skillId: math.id }),
    ),
    chapterSkillFixture({ chapterId: mixed.id, skillId: science.id }),
    chapterSkillFixture({ chapterId: unmapped.id, skillId: orphan.id }),
    prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: {
          phases: [{ name: "Exam" }],
          skills: [
            { area: "Math", skillId: math.id },
            { area: "Science", skillId: science.id },
          ],
        },
        model: "fixture",
        primaryCourseId: course.id,
        promptVersion: "fixture",
        runId: "fixture",
      },
    }),
  ]);

  const scope: EnemAreaScope = { blueprintId: blueprint.id, courseId: course.id, language: "en" };
  return { agreed, course, math, mixed, orphan, science, scope, unmapped };
}

function preview(scope: EnemAreaScope) {
  return prisma.$transaction(
    async (db) => {
      await db.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return prepareEnemAreaManifest({ db, scope, target: TARGET });
    },
    { isolationLevel: "RepeatableRead" },
  );
}

describe("reviewed ENEM area backfill", () => {
  it("repairs only the reviewed exam-course link, preserving its graph and refusing a stale link", async () => {
    const [fixture, subject, another] = await Promise.all([
      lineageFixture(),
      courseFixture({ isPublished: true, visibility: "public" }),
      courseFixture({ isPublished: true, visibility: "public" }),
    ]);

    await prisma.examSkillGraph.update({
      data: { primaryCourseId: subject.id },
      where: { examBlueprintId: fixture.scope.blueprintId },
    });

    const before = await prisma.examSkillGraph.findUniqueOrThrow({
      where: { examBlueprintId: fixture.scope.blueprintId },
    });

    const manifest = await preview(fixture.scope);

    const apply = () =>
      prisma.$transaction(
        (db) => applyEnemAreaManifest({ db, manifest, scope: fixture.scope, target: TARGET }),
        { isolationLevel: "Serializable" },
      );

    await apply();

    const after = await prisma.examSkillGraph.findUniqueOrThrow({
      where: { examBlueprintId: fixture.scope.blueprintId },
    });
    /** Prisma updates the write timestamp; graph content and generation provenance stay exact. */
    expect(after).toStrictEqual({
      ...before,
      primaryCourseId: fixture.scope.courseId,
      updatedAt: after.updatedAt,
    });

    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    await apply();

    await prisma.examSkillGraph.update({
      data: { primaryCourseId: another.id },
      where: { examBlueprintId: fixture.scope.blueprintId },
    });

    await expect(apply()).rejects.toThrow("link changed");

    await expect(
      prisma.examSkillGraph.findUniqueOrThrow({
        where: { examBlueprintId: fixture.scope.blueprintId },
      }),
    ).resolves.toMatchObject({ graph: before.graph, primaryCourseId: another.id });
  });

  it("proposes only complete unanimous public lineage, leaving mixed and orphan tags unknown", async () => {
    const fixture = await lineageFixture();
    const manifest = await preview(fixture.scope);

    expect(
      manifest.candidates.map((row) => ({ area: row.area, chapterId: row.chapterId })),
    ).toStrictEqual([{ area: "Math", chapterId: fixture.agreed.id }]);

    await expect(
      prisma.courseChapter.count({ where: { area: { not: null }, courseId: fixture.course.id } }),
    ).resolves.toBe(0);
  });

  it("writes only reviewed null placements, is idempotent, and refuses existing conflicts", async () => {
    const fixture = await lineageFixture();
    const manifest = await preview(fixture.scope);

    const apply = () =>
      prisma.$transaction(
        (db) => applyEnemAreaManifest({ db, manifest, scope: fixture.scope, target: TARGET }),
        { isolationLevel: "Serializable" },
      );

    await skillFixture({ name: "An unrelated concurrently published skill" });

    await expect(apply()).resolves.toStrictEqual({
      alreadyAssigned: 0,
      examCourseLinkUpdated: false,
      updated: 1,
    });

    await expect(apply()).resolves.toStrictEqual({
      alreadyAssigned: 1,
      examCourseLinkUpdated: false,
      updated: 0,
    });

    await prisma.courseChapter.update({
      data: { area: "Science" },
      where: { courseId_chapterId: { chapterId: fixture.agreed.id, courseId: fixture.course.id } },
    });

    await expect(apply()).rejects.toThrow("conflicting");

    await expect(
      prisma.courseChapter.findUniqueOrThrow({
        where: {
          courseId_chapterId: { chapterId: fixture.agreed.id, courseId: fixture.course.id },
        },
      }),
    ).resolves.toMatchObject({ area: "Science" });
  });

  it("refuses changed source evidence, altered proposals and a different target before writing", async () => {
    const fixture = await lineageFixture();
    const manifest = await preview(fixture.scope);

    const apply = (reviewed: unknown = manifest, target = TARGET) =>
      prisma.$transaction(
        (db) => applyEnemAreaManifest({ db, manifest: reviewed, scope: fixture.scope, target }),
        { isolationLevel: "Serializable" },
      );

    await expect(apply({ ...manifest, candidates: [] })).rejects.toThrow("proposal");
    const { examCourseLink: _link, ...withoutLink } = manifest;
    await expect(apply(withoutLink)).rejects.toThrow("explicit exam-course link");

    await expect(apply(manifest, { ...TARGET, database: "another-database" })).rejects.toThrow(
      "target",
    );

    await chapterSkillFixture({ chapterId: fixture.agreed.id, skillId: fixture.science.id });
    await expect(apply()).rejects.toThrow("Source changed");

    await expect(
      prisma.courseChapter.count({ where: { area: { not: null }, courseId: fixture.course.id } }),
    ).resolves.toBe(0);
  });

  it("refuses unpublished/private courses and private exam graphs", async () => {
    const fixture = await lineageFixture();

    await prisma.course.update({
      data: { visibility: "private" },
      where: { id: fixture.course.id },
    });

    await expect(preview(fixture.scope)).rejects.toThrow("public published");

    await prisma.course.update({
      data: { isPublished: false, visibility: "public" },
      where: { id: fixture.course.id },
    });

    await expect(preview(fixture.scope)).rejects.toThrow("public published");
    await prisma.course.update({ data: { isPublished: true }, where: { id: fixture.course.id } });

    await prisma.examBlueprint.update({
      data: { visibility: "private" },
      where: { id: fixture.scope.blueprintId },
    });

    const manifest = await preview(fixture.scope);
    expect(manifest.candidates).toStrictEqual([]);
  });
});
