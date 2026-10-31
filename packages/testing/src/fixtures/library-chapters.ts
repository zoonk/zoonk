import { randomUUID } from "node:crypto";
import {
  type Chapter,
  type ChapterSkill,
  type CourseChapter,
  type CourseLevel,
  prisma,
} from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";
import { chapterLessonFixture, lessonSkillFixture, libraryLessonFixture } from "./library-lessons";
import { skillFixture } from "./skills";

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

/** Tests that place several chapters in parallel should pass positions. */
export async function courseChapterFixture(
  attrs: Pick<CourseChapter, "chapterId" | "courseId"> & Partial<CourseChapter>,
) {
  const level = attrs.level ?? "beginner";

  const position =
    attrs.position ??
    (await prisma.courseChapter.count({ where: { courseId: attrs.courseId, level } }));

  return prisma.courseChapter.create({ data: { ...attrs, level, position } });
}

export async function chapterSkillFixture(attrs: Pick<ChapterSkill, "chapterId" | "skillId">) {
  return prisma.chapterSkill.create({ data: attrs });
}

export async function courseBandsFixture({
  courseId,
  levels,
}: {
  courseId: string;
  levels: readonly CourseLevel[];
}) {
  return Promise.all(
    levels.map(async (level) => {
      const [chapter, skill, lesson] = await Promise.all([
        libraryChapterFixture({ level, title: `Test ${level} chapter` }),
        skillFixture({ name: `Test ${level} skill` }),
        libraryLessonFixture({ estimatedMinutes: 3, level, title: `Test ${level} lesson` }),
      ]);

      await Promise.all([
        courseChapterFixture({ chapterId: chapter.id, courseId, level, position: 0 }),
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      ]);

      return { chapter, lesson, skill };
    }),
  );
}
