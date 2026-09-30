import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { getCourseCurriculumCacheTag } from "../../cache/tags";
import { attachChapterToCourse } from "./attach-course-chapter";
import { type CreateLibraryChapterInput, createLibraryChapter } from "./create-library-chapter";

function chapterInput(
  overrides: Partial<CreateLibraryChapterInput> = {},
): CreateLibraryChapterInput {
  return {
    description: "Proportions in everyday prices",
    homeCourseId: null,
    identityKey: `test-chapter-${randomUUID()}`,
    language: "pt",
    level: "beginner",
    objectives: ["Resolver uma regra de três"],
    ownerId: null,
    provenance: {
      generatedAt: "2026-09-01T12:00:00.000Z",
      model: "test/outliner",
      promptVersion: "test-v1",
      runId: randomUUID(),
    },
    targetLanguage: null,
    title: "Regra de três",
    ...overrides,
  };
}

describe(createLibraryChapter, () => {
  it("creates a public chapter with a slug unique in its home course", async () => {
    const course = await courseFixture();
    const title = `Regra de três ${randomUUID()}`;
    const first = await createLibraryChapter(chapterInput({ homeCourseId: course.id, title }));
    const second = await createLibraryChapter(chapterInput({ homeCourseId: course.id, title }));

    expect(first).toMatchObject({
      chapter: {
        generatedAt: new Date("2026-09-01T12:00:00.000Z"),
        model: "test/outliner",
        normalizedTitle: normalizeString(title),
        outlineStatus: "pending",
        visibility: "public",
      },
      created: true,
    });

    expect(second.chapter.slug).toBe(`${first.chapter.slug}-2`);
  });

  it("creates one row when two requests for the same identity race", async () => {
    const input = chapterInput();

    const results = await Promise.all([
      createLibraryChapter(input),
      createLibraryChapter({ ...input, provenance: { ...input.provenance, runId: randomUUID() } }),
    ]);

    expect(results[0].chapter.id).toBe(results[1].chapter.id);
    expect(results.filter((result) => result.created)).toHaveLength(1);

    await expect(
      prisma.chapter.count({ where: { identityKey: input.identityKey, language: "pt" } }),
    ).resolves.toBe(1);
  });

  it("never gives shared content a private home course", async () => {
    const owner = await userFixture();
    const privateCourse = await courseFixture({ userId: owner.id, visibility: "private" });

    await expect(
      createLibraryChapter(chapterInput({ homeCourseId: privateCourse.id })),
    ).rejects.toThrow("same visibility");

    const key = scopeIdentityKey({ key: `test-chapter-${randomUUID()}`, ownerId: owner.id });

    await expect(
      createLibraryChapter(
        chapterInput({ homeCourseId: privateCourse.id, identityKey: key, ownerId: owner.id }),
      ),
    ).resolves.toMatchObject({ chapter: { ownerId: owner.id, visibility: "private" } });
  });
});

describe(attachChapterToCourse, () => {
  it("places a chapter in a level band and moves it when placed again", async () => {
    const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

    await attachChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    });

    const moved = await attachChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      level: "intermediate",
      position: 2,
    });

    expect(moved).toMatchObject({ level: "intermediate", position: 2 });
    await expect(prisma.courseChapter.count({ where: { courseId: course.id } })).resolves.toBe(1);

    expect(revalidateTag).toHaveBeenCalledWith(getCourseCurriculumCacheTag(course.id), {
      expire: 0,
    });
  });

  it("keeps private chapters out of other learners' and shared courses", async () => {
    const [owner, otherOwner] = await Promise.all([userFixture(), userFixture()]);

    const [publicCourse, otherPrivateCourse, ownPrivateCourse, privateChapter] = await Promise.all([
      courseFixture(),
      courseFixture({ userId: otherOwner.id, visibility: "private" }),
      courseFixture({ userId: owner.id, visibility: "private" }),
      libraryChapterFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    const placement = { chapterId: privateChapter.id, level: "beginner" as const, position: 0 };

    await expect(
      attachChapterToCourse({ ...placement, courseId: publicCourse.id }),
    ).rejects.toThrow("Private content");

    await expect(
      attachChapterToCourse({ ...placement, courseId: otherPrivateCourse.id }),
    ).rejects.toThrow("Private content");

    await expect(
      attachChapterToCourse({ ...placement, courseId: ownPrivateCourse.id }),
    ).resolves.toMatchObject({ courseId: ownPrivateCourse.id });
  });
});
