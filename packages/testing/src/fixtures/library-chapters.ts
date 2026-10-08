import { randomUUID } from "node:crypto";
import { type Chapter, type ChapterSkill, type CourseChapter, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

/** Creates a shared Library chapter with a unique identity key and slug. */
export async function libraryChapterFixture(attrs?: FixtureAttrs<Chapter, "tools">) {
  const key = randomUUID();
  const title = attrs?.title ?? "Test Library Chapter";

  return prisma.chapter.create({
    data: {
      description: "Test library chapter description",
      identityKey: `test-chapter-${key}`,
      language: "en",
      level: "beginner",
      normalizedTitle: normalizeString(title),
      objectives: ["Explain the test objective"],
      slug: `test-library-chapter-${key}`,
      title,
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

/**
 * Places a chapter in a course outline. Without a position it goes after the chapters already in
 * that level band; tests that place several chapters in parallel should pass positions.
 */
export async function courseChapterFixture(
  attrs: Pick<CourseChapter, "chapterId" | "courseId"> & Partial<CourseChapter>,
) {
  const level = attrs.level ?? "beginner";

  const position =
    attrs.position ??
    (await prisma.courseChapter.count({ where: { courseId: attrs.courseId, level } }));

  return prisma.courseChapter.create({ data: { ...attrs, level, position } });
}

/** Links a skill to a Library chapter that teaches it. */
export async function chapterSkillFixture(attrs: Pick<ChapterSkill, "chapterId" | "skillId">) {
  return prisma.chapterSkill.create({ data: attrs });
}
