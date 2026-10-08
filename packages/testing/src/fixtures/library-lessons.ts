import { randomUUID } from "node:crypto";
import { type ChapterLesson, type Lesson, type LessonSkill, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

const DEFAULT_ESTIMATED_MINUTES = 4;

/**
 * Creates a shared Library lesson outline (title and description) with a unique identity key and,
 * unless given one, a unique title: plans teach a title once, so lessons of one plan need their own.
 */
export async function libraryLessonFixture(
  attrs?: FixtureAttrs<Lesson, "heldBackDrafts" | "spec" | "summary">,
) {
  const key = randomUUID();
  const title = attrs?.title ?? `Test Library Lesson ${key.split("-")[0]}`;

  return prisma.lesson.create({
    data: {
      description: "Test library lesson description",
      estimatedMinutes: DEFAULT_ESTIMATED_MINUTES,
      identityKey: `test-lesson-${key}`,
      language: "en",
      level: "beginner",
      normalizedTitle: normalizeString(title),
      slug: `test-library-lesson-${key}`,
      title,
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

/**
 * Places a lesson in a chapter. Without a position it goes after the chapter's current lessons;
 * tests that place several lessons in parallel should pass positions.
 */
export async function chapterLessonFixture(
  attrs: Pick<ChapterLesson, "chapterId" | "lessonId"> & Partial<ChapterLesson>,
) {
  const position =
    attrs.position ?? (await prisma.chapterLesson.count({ where: { chapterId: attrs.chapterId } }));

  return prisma.chapterLesson.create({ data: { ...attrs, position } });
}

/** Links a skill to a lesson that teaches it. */
export async function lessonSkillFixture(attrs: Pick<LessonSkill, "lessonId" | "skillId">) {
  return prisma.lessonSkill.create({ data: attrs });
}

/** One draft the quality gate held back, as `Lesson.heldBackDrafts` stores it. */
export function heldBackDraftFixture(
  attrs: Partial<{ model: string; problems: { problem: string; screen: number | null }[] }> = {},
) {
  return {
    heldBackAt: new Date().toISOString(),
    model: "openai/gpt-6-sol",
    problems: [{ problem: "The option marked correct is wrong.", screen: 3 }],
    runId: `test-run-${randomUUID()}`,
    ...attrs,
  };
}
