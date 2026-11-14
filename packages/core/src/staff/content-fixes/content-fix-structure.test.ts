import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import {
  approve,
  proposeFix,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

async function apply(changes: object[]) {
  await signInProposer();
  const fix = await proposeFix({ changes, reason: "Correct the shared curriculum." });
  const { key } = await signInApprover();

  await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
    fix: { status: "applied" },
  });

  return fix;
}

describe("staff curriculum collections", () => {
  it("reorders lessons, keeps addresses, and reverts the collection", async () => {
    const chapter = await libraryChapterFixture();
    const first = await libraryLessonFixture({ homeChapterId: chapter.id });
    const second = await libraryLessonFixture({ homeChapterId: chapter.id });
    await chapterLessonFixture({ chapterId: chapter.id, lessonId: first.id, position: 0 });
    await chapterLessonFixture({ chapterId: chapter.id, lessonId: second.id, position: 1 });
    const fix = await apply([{ id: chapter.id, model: "Chapter", setLessons: [second.id] }]);

    await expect(
      prisma.chapterLesson.findMany({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject([{ lessonId: second.id, position: 0 }]);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: first.id } }),
    ).resolves.toMatchObject({ homeChapterId: chapter.id, slug: first.slug });

    await signInProposer();
    const inverse = await revertFix({ fixId: fix.id, reason: "Restore the original curriculum." });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    const { key } = await signInApprover();

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      prisma.chapterLesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId: chapter.id },
      }),
    ).resolves.toMatchObject([{ lessonId: first.id }, { lessonId: second.id }]);
  });

  it("reorders chapters without position collisions", async () => {
    const course = await courseFixture({ isPublished: true });
    const first = await libraryChapterFixture();
    const second = await libraryChapterFixture();

    await courseChapterFixture({
      chapterId: first.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    });

    await courseChapterFixture({
      chapterId: second.id,
      courseId: course.id,
      level: "beginner",
      position: 1,
    });

    await apply([
      {
        id: course.id,
        model: "Course",
        setChapters: [
          { area: null, chapterId: second.id, level: "beginner" },
          { area: null, chapterId: first.id, level: "beginner" },
        ],
      },
    ]);

    await expect(
      prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      }),
    ).resolves.toMatchObject([
      { chapterId: second.id, position: 0 },
      { chapterId: first.id, position: 1 },
    ]);
  });

  it("changes chapter and lesson skill memberships while retaining their timestamps", async () => {
    const chapter = await libraryChapterFixture();
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    const first = await skillFixture();
    const second = await skillFixture();
    const kept = await lessonSkillFixture({ lessonId: lesson.id, skillId: first.id });
    await apply([{ id: chapter.id, model: "Chapter", setSkills: [first.id, second.id] }]);
    await apply([{ id: lesson.id, model: "Lesson", setSkills: [first.id, second.id] }]);

    await expect(
      prisma.lessonSkill.findUniqueOrThrow({
        where: { lessonId_skillId: { lessonId: lesson.id, skillId: first.id } },
      }),
    ).resolves.toMatchObject({ createdAt: kept.createdAt });
  });

  it("refuses a newly cyclic edge while allowing removal from an existing cycle", async () => {
    const first = await skillFixture();
    const second = await skillFixture();
    await apply([{ id: first.id, model: "Skill", setPrerequisites: [second.id] }]);
    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [{ id: second.id, model: "Skill", setPrerequisites: [first.id] }],
        reason: "Would create a cycle.",
      }),
    ).resolves.toMatchObject({ message: expect.stringContaining("cycle"), status: "invalid" });

    await prisma.skillPrerequisite.create({
      data: { prerequisiteId: first.id, skillId: second.id },
    });

    await apply([{ id: first.id, model: "Skill", setPrerequisites: [] }]);
  });

  it("refuses empty, duplicate, dangling, private, cross-language and merged children", async () => {
    const chapter = await libraryChapterFixture();
    const publicLesson = await libraryLessonFixture();
    const privateLesson = await libraryLessonFixture({ visibility: "private" });
    const otherLanguage = await libraryLessonFixture({ language: "pt" });
    await signInProposer();

    for (const lessons of [
      [],
      [publicLesson.id, publicLesson.id],
      [randomUUID()],
      [privateLesson.id],
      [otherLanguage.id],
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- each proposal uses the same signed-in staff session
      await expect(
        proposeContentFix({
          changes: [{ id: chapter.id, model: "Chapter", setLessons: lessons }],
          reason: "Invalid curriculum.",
        }),
      ).resolves.toMatchObject({ status: "invalid" });
    }

    const survivor = await skillFixture();
    const merged = await skillFixture({ mergedIntoId: survivor.id });

    await expect(
      proposeContentFix({
        changes: [{ id: chapter.id, model: "Chapter", setSkills: [merged.id] }],
        reason: "Merged skill.",
      }),
    ).resolves.toMatchObject({ message: expect.stringContaining(survivor.id), status: "invalid" });
  });
});

describe("shared plan graphs", () => {
  it("fixes future language graphs, reverts and refuses invalid references", async () => {
    const course = await courseFixture({ isPublished: true });
    const skill = await skillFixture();

    const graph = {
      phases: [{ milestone: null, name: "Learn" }],
      skills: [
        {
          area: null,
          courseIds: [course.id],
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    };

    const row = await prisma.languageSkillGraph.create({
      data: {
        generatedAt: new Date(),
        graph,
        model: "test",
        primaryCourseId: course.id,
        promptKey: randomUUID(),
        promptVersion: "test",
        runId: "test",
      },
    });

    const fixed = { ...graph, skills: graph.skills.map((entry) => ({ ...entry, lessons: 2 })) };

    const fix = await apply([
      { id: row.id, model: "LanguageSkillGraph", setGraph: { graph: fixed } },
    ]);

    expect(fix.effects).toContainEqual({ kind: "existingPlanGraphsKept" });

    await expect(
      prisma.languageSkillGraph.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ graph: fixed });

    await signInProposer();

    for (const invalid of [
      { ...graph, skills: [...graph.skills, ...graph.skills] },
      { ...graph, skills: [{ ...graph.skills[0], skillId: randomUUID() }] },
      { ...graph, skills: [{ ...graph.skills[0], phase: 10 }] },
      { ...graph, skills: [{ ...graph.skills[0], weight: 6 }] },
      {
        ...graph,
        optionSkills: [{ ...graph.skills[0], after: randomUUID(), skillId: randomUUID() }],
      },
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- proposals share a staff session
      await expect(
        proposeContentFix({
          changes: [{ id: row.id, model: "LanguageSkillGraph", setGraph: { graph: invalid } }],
          reason: "Invalid graph.",
        }),
      ).resolves.toMatchObject({ status: "invalid" });
    }

    const inverse = await revertFix({ fixId: fix.id, reason: "Restore graph." });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    const { key } = await signInApprover();

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });
  });
});
