import { prisma } from "@zoonk/db";
import {
  chapterSkillFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { loadChapterTaughtLessons } from "./chapter-taught-lessons";

function sortIds(ids: readonly string[]): string[] {
  return ids.toSorted((a, b) => a.localeCompare(b));
}

/** Two chapters no course places, each the home of one lesson. */
async function unplacedChapters(title: string) {
  const chapters = await Promise.all(
    [1, 2].map((index) => libraryChapterFixture({ title: `${title} ${index}` })),
  );

  const lessons = await Promise.all(
    chapters.map((chapter, index) =>
      libraryLessonFixture({ homeChapterId: chapter.id, title: `${title} lesson ${index + 1}` }),
    ),
  );

  return { chapters, lessons };
}

/** Tags each chapter with the skill one at a time, in this order, so the rows are stored in it. */
async function tagInOrder({
  chapterIds,
  skillId,
}: {
  chapterIds: readonly string[];
  skillId: string;
}) {
  for (const chapterId of chapterIds) {
    // oxlint-disable-next-line no-await-in-loop -- the order the tags are written in is the point
    await chapterSkillFixture({ chapterId, skillId });
  }
}

function loadTaught(skillId: string) {
  return loadChapterTaughtLessons({
    skillIds: [skillId],
    userId: null,
    withChallenges: true,
    withToolChapters: true,
  });
}

describe(loadChapterTaughtLessons, () => {
  it("orders tagged chapters tied on course order by chapter, whatever order the database returns", async () => {
    const [skill, { chapters, lessons }] = await Promise.all([
      skillFixture({ name: "Solve linear equations" }),
      unplacedChapters("Linear equations"),
    ]);

    // Both lessons sit at position 0 of a chapter no course places: they tie.
    await Promise.all(
      lessons.map((lesson, index) =>
        chapterLessonFixture({
          chapterId: chapters[index]?.id ?? "",
          lessonId: lesson.id,
          position: 0,
        }),
      ),
    );

    const byId = sortIds(chapters.map((chapter) => chapter.id));

    // Tagged in reverse id order, and the lower-id chapter rewritten after: both its tag and its
    // chapter row are stored after the other's, so a read in storage order returns it second.
    await tagInOrder({ chapterIds: byId.toReversed(), skillId: skill.id });

    await prisma.chapter.update({
      data: { description: "Rewritten after its tag" },
      where: { id: byId[0] ?? "" },
    });

    const taught = await loadTaught(skill.id);

    expect(taught.map((lesson) => lesson.chapterId)).toStrictEqual(byId);
  });

  it("keeps the lessons' positions ahead of the chapters' ids", async () => {
    const [skill, { chapters, lessons }] = await Promise.all([
      skillFixture({ name: "Solve quadratic equations" }),
      unplacedChapters("Quadratic equations"),
    ]);

    // The chapter with the larger id holds the earlier lesson: the position decides, not the id.
    const [later, earlier] = sortIds(chapters.map((chapter) => chapter.id));

    await Promise.all(
      chapters.map((chapter, index) =>
        chapterLessonFixture({
          chapterId: chapter.id,
          lessonId: lessons[index]?.id ?? "",
          position: chapter.id === earlier ? 0 : 1,
        }),
      ),
    );

    await tagInOrder({ chapterIds: [later ?? "", earlier ?? ""], skillId: skill.id });

    const taught = await loadTaught(skill.id);

    expect(taught.map((lesson) => lesson.chapterId)).toStrictEqual([earlier, later]);
  });
});
