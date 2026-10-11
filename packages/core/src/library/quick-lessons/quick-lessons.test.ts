import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadSkillLessons } from "../../plans/_utils/planner-lessons";
import { loadLessonSpecInputs } from "../curriculum/lesson-spec-inputs";
import { loadPublishedLessonInputs } from "../lessons/_utils/lesson-writing-inputs";
import { temperatureSpec } from "../quality/_test-utils/written-lessons";
import {
  QUICK_LESSON_MINUTES,
  getQuickLessonIdentityKey,
  isQuickLessonIdentityKey,
} from "./quick-lesson-identity";
import { ensureQuickLessons, findQuickLessons } from "./quick-lessons";

/** A skill of an ENEM biology chapter, taught there by one regular lesson. */
async function taughtSkill() {
  const course = await courseFixture({ language: "pt", title: "Biologia" });

  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({
      homeCourseId: course.id,
      language: "pt",
      level: "intermediate",
      title: "Biomoléculas",
    }),
    skillFixture({
      description: "A ordem dos aminoácidos define a forma da proteína e o que ela faz.",
      language: "pt",
      level: "intermediate",
      name: "Relacionar estrutura proteica e função",
    }),
  ]);

  const lesson = await libraryLessonFixture({
    homeChapterId: chapter.id,
    language: "pt",
    level: "intermediate",
    title: "Proteínas e enzimas",
  });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "intermediate" }),
    chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
  ]);

  return { chapter, lesson, skill };
}

describe(ensureQuickLessons, () => {
  it("writes one shared quick lesson per skill, outside every chapter, and the same one every time", async () => {
    const { chapter, skill } = await taughtSkill();

    const [first, again] = await Promise.all([
      ensureQuickLessons({ skillIds: [skill.id] }),
      ensureQuickLessons({ skillIds: [skill.id] }),
    ]);

    const quick = first.get(skill.id);

    expect(quick).toStrictEqual({
      estimatedMinutes: QUICK_LESSON_MINUTES,
      lessonId: expect.any(String),
      title: "Aula rápida: Relacionar estrutura proteica e função",
    });

    expect(again.get(skill.id)).toStrictEqual(quick);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      include: { chapters: true, skills: true },
      where: { id: quick?.lessonId },
    });

    expect(lesson).toMatchObject({
      canDo: "Relacionar estrutura proteica e função",
      contentStatus: "pending",
      description: "A ordem dos aminoácidos define a forma da proteína e o que ela faz.",
      homeChapterId: chapter.id,
      language: "pt",
      level: "intermediate",
      ownerId: null,
      specStatus: "pending",
      visibility: "public",
    });

    expect(isQuickLessonIdentityKey(lesson.identityKey)).toBe(true);
    expect(lesson.skills.map((entry) => entry.skillId)).toStrictEqual([skill.id]);
    // It's never placed in a chapter: chapter pages and outlines never list it.
    expect(lesson.chapters).toStrictEqual([]);

    // Another skill's, asked later, is its own lesson.
    const other = await skillFixture({ language: "pt", name: "Explicar a ação de uma enzima" });
    const both = await ensureQuickLessons({ skillIds: [skill.id, other.id] });

    expect(both.get(skill.id)).toStrictEqual(quick);
    expect(both.get(other.id)?.lessonId).not.toBe(quick?.lessonId);
  });

  it("keeps a private skill's quick lesson private to its owner", async () => {
    const owner = await userFixture();

    const skill = await skillFixture({
      language: "pt",
      name: "Montar a tabela das organelas",
      ownerId: owner.id,
      visibility: "private",
    });

    const quickLessons = await ensureQuickLessons({ skillIds: [skill.id] });
    const quick = quickLessons.get(skill.id);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: quick?.lessonId } }),
    ).resolves.toMatchObject({ homeChapterId: null, ownerId: owner.id, visibility: "private" });
  });

  it("is never planned as one of its skill's lessons", async () => {
    const [{ lesson, skill }, user] = await Promise.all([taughtSkill(), userFixture()]);
    await ensureQuickLessons({ skillIds: [skill.id] });

    const lessons = await loadSkillLessons({
      goal: { examBlueprintId: null, kind: "exam" },
      skillIds: [skill.id],
      userId: user.id,
    });

    expect(lessons.map((entry) => entry.lessonId)).toStrictEqual([lesson.id]);
  });

  it("is planned and written as a quick lesson of its skill alone, without its chapter's lessons", async () => {
    const { lesson, skill } = await taughtSkill();
    const quickLessons = await ensureQuickLessons({ skillIds: [skill.id] });
    const quickId = quickLessons.get(skill.id)?.lessonId ?? "";

    const [quickInputs, lessonInputs] = await Promise.all([
      loadLessonSpecInputs(quickId),
      loadLessonSpecInputs(lesson.id),
    ]);

    expect(quickInputs?.prompt).toMatchObject({
      chapterLessons: [],
      chapterTitle: "Biomoléculas",
      courseTitle: "Biologia",
      language: "pt",
      lessonTitle: "Aula rápida: Relacionar estrutura proteica e função",
      level: "intermediate",
      quick: true,
      skills: ["Relacionar estrutura proteica e função"],
    });

    expect(lessonInputs?.prompt.quick).toBe(false);

    await prisma.lesson.update({
      data: { spec: temperatureSpec(), specStatus: "completed" },
      where: { id: quickId },
    });

    await expect(loadPublishedLessonInputs(quickId)).resolves.toMatchObject({ chapterLessons: [] });
  });
});

describe(findQuickLessons, () => {
  it("reads the quick lessons that exist without creating any, leaving out one set aside", async () => {
    const [{ skill }, other, setAside] = await Promise.all([
      taughtSkill(),
      skillFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    await expect(findQuickLessons({ skillIds: [skill.id] })).resolves.toStrictEqual(new Map());

    const made = await ensureQuickLessons({ skillIds: [skill.id, setAside.id] });

    // A quick lesson whose drafts were all held back can't be taught: plans don't place it.
    await prisma.lesson.update({
      data: { setAsideAt: new Date() },
      where: { id: made.get(setAside.id)?.lessonId },
    });

    const found = await findQuickLessons({ skillIds: [skill.id, other.id, setAside.id] });

    expect(found).toStrictEqual(new Map([[skill.id, made.get(skill.id)]]));
    await expect(ensureQuickLessons({ skillIds: [setAside.id] })).resolves.toStrictEqual(new Map());

    await expect(
      prisma.lesson.count({
        where: { identityKey: getQuickLessonIdentityKey({ ownerId: null, skillId: other.id }) },
      }),
    ).resolves.toBe(0);
  });
});
