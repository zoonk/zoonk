import { randomUUID } from "node:crypto";
import { type ChapterLesson, type Lesson, type LessonSkill, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

const DEFAULT_ESTIMATED_MINUTES = 4;

type LessonAttrs = FixtureAttrs<Lesson, "heldBackDrafts" | "spec" | "summary">;

/** A lesson row with a unique identity key and, unless given one, a unique title. */
function lessonData(attrs?: LessonAttrs) {
  const key = randomUUID();
  const title = attrs?.title ?? `Test Library Lesson ${key.split("-")[0]}`;

  return {
    description: "Test library lesson description",
    estimatedMinutes: DEFAULT_ESTIMATED_MINUTES,
    identityKey: `test-lesson-${key}`,
    language: "en",
    level: "beginner" as const,
    normalizedTitle: normalizeString(title),
    slug: `test-library-lesson-${key}`,
    title,
    ...fixtureProvenance(),
    ...attrs,
  };
}

/**
 * Creates a shared Library lesson outline (title and description) with a unique identity key and,
 * unless given one, a unique title: plans teach a title once, so lessons of one plan need their own.
 */
export async function libraryLessonFixture(attrs?: LessonAttrs) {
  return prisma.lesson.create({ data: lessonData(attrs) });
}

/**
 * `count` lessons like `libraryLessonFixture`'s, each with a title of its own, in one statement: a
 * test that outlines whole chapters doesn't wait on a round trip per lesson.
 */
export async function libraryLessonsFixture(
  count: number,
  attrs?: Omit<LessonAttrs, "identityKey" | "normalizedTitle" | "slug" | "title">,
) {
  return prisma.lesson.createManyAndReturn({
    data: Array.from({ length: count }, () => lessonData(attrs)),
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
