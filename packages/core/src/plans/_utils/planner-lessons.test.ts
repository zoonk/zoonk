import { randomUUID } from "node:crypto";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { loadSkillLessons } from "./planner-lessons";

const LEARN_GOAL = { examBlueprintId: null, kind: "learn" } as const;

function sortIds(ids: readonly string[]): string[] {
  return ids.toSorted((a, b) => a.localeCompare(b));
}

/** Links each lesson to the skill one at a time, in this order, so the rows are stored in it. */
async function linkInOrder({
  lessonIds,
  skillId,
}: {
  lessonIds: readonly string[];
  skillId: string;
}) {
  for (const lessonId of lessonIds) {
    // oxlint-disable-next-line no-await-in-loop -- the order the links are written in is the point
    await lessonSkillFixture({ lessonId, skillId });
  }
}

describe(loadSkillLessons, () => {
  it("orders lessons tied on course order and creation by id, whatever order the database returns", async () => {
    // One instant for every row, as rows written by one statement share it.
    freezeClock();

    const [skill, chapters] = await Promise.all([
      skillFixture({ name: "Read a balance sheet" }),
      Promise.all(
        [1, 2].map((index) => libraryChapterFixture({ title: `Balance sheets ${index}` })),
      ),
    ]);

    // Written one at a time, the higher id first: the lessons and their links to the skill are
    // both stored in reverse id order.
    const byId = sortIds([randomUUID(), randomUUID()]);

    const places = byId
      .toReversed()
      .map((lessonId, index) => ({ chapterId: chapters[index]?.id ?? "", lessonId }));

    for (const [index, { chapterId, lessonId }] of places.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- the order the lessons are written in is the point
      await libraryLessonFixture({
        homeChapterId: chapterId,
        id: lessonId,
        title: `Balance sheet ${index + 1}`,
      });
    }

    // Each lesson is the first of its own chapter, and no course places either chapter: they tie.
    await Promise.all(places.map((place) => chapterLessonFixture({ ...place, position: 0 })));

    await linkInOrder({ lessonIds: byId.toReversed(), skillId: skill.id });

    const planned = await loadSkillLessons({
      goal: LEARN_GOAL,
      skillIds: [skill.id],
      userId: null,
    });

    expect(planned.map((lesson) => lesson.lessonId)).toStrictEqual(byId);
  });

  it("keeps a chapter's lesson order when it disagrees with the lessons' ids", async () => {
    freezeClock();

    const [skill, chapter] = await Promise.all([
      skillFixture({ name: "Read a cash flow statement" }),
      libraryChapterFixture({ title: "Cash flow" }),
    ]);

    const lessons = await Promise.all(
      [1, 2].map((index) =>
        libraryLessonFixture({ homeChapterId: chapter.id, title: `Cash flow ${index}` }),
      ),
    );

    // The larger id comes first in the chapter: the position decides, not the id.
    const [first, second] = sortIds(lessons.map((lesson) => lesson.id)).toReversed();

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: first ?? "", position: 0 }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: second ?? "", position: 1 }),
    ]);

    await linkInOrder({ lessonIds: [second ?? "", first ?? ""], skillId: skill.id });

    const planned = await loadSkillLessons({
      goal: LEARN_GOAL,
      skillIds: [skill.id],
      userId: null,
    });

    expect(planned.map((lesson) => lesson.lessonId)).toStrictEqual([first, second]);
  });
});
