import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { loadItemSkillRows } from "./goal-skill-graph";

function sortIds(ids: readonly string[]): string[] {
  return ids.toSorted((a, b) => a.localeCompare(b));
}

/** Two skills, their ids in ascending order. */
async function twoSkills(name: string) {
  const skills = await Promise.all(
    [1, 2].map((index) => skillFixture({ name: `${name} part ${index}` })),
  );

  const [lower, higher] = sortIds(skills.map((skill) => skill.id));
  return { higher: higher ?? "", lower: lower ?? "" };
}

/** A lesson in a chapter of its own. */
async function lessonInChapter(title: string) {
  const [chapter, lesson] = await Promise.all([
    libraryChapterFixture({ title }),
    libraryLessonFixture({ title }),
  ]);

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });
  return { chapterId: chapter.id, lessonId: lesson.id };
}

describe(loadItemSkillRows, () => {
  it("lists lessons' skills linked at one instant by skill id, whatever order the database returns", async () => {
    // One instant for every row, as a lesson's skills written by one statement share it.
    freezeClock();

    const [skills, lessons] = await Promise.all([
      twoSkills("Adding fractions"),
      Promise.all([1, 2].map((index) => libraryLessonFixture({ title: `Fractions ${index}` }))),
    ]);

    const [lowerLesson, higherLesson] = sortIds(lessons.map((lesson) => lesson.id));

    // The lesson with the lower id teaches the higher skill, and it's linked first: the primary
    // key (lesson, then skill) and the stored row order both list the higher skill first.
    await lessonSkillFixture({ lessonId: lowerLesson ?? "", skillId: skills.higher });
    await lessonSkillFixture({ lessonId: higherLesson ?? "", skillId: skills.lower });

    const rows = await loadItemSkillRows({
      chapterIds: [],
      lessonIds: [lowerLesson ?? "", higherLesson ?? ""],
    });

    expect(rows.lessonSkills.map((row) => row.skillId)).toStrictEqual([
      skills.lower,
      skills.higher,
    ]);
  });

  it("lists a chapter lesson's skills linked at one instant by skill id, whatever order the database returns", async () => {
    freezeClock();

    const [skills, { chapterId, lessonId }] = await Promise.all([
      twoSkills("Comparing fractions"),
      lessonInChapter("Comparing fractions"),
    ]);

    // Linked in reverse id order, so the stored row order is the reverse of id order.
    await lessonSkillFixture({ lessonId, skillId: skills.higher });
    await lessonSkillFixture({ lessonId, skillId: skills.lower });

    const rows = await loadItemSkillRows({ chapterIds: [chapterId], lessonIds: [] });

    expect(
      rows.chapterLessons.flatMap((row) => row.lesson.skills.map((skill) => skill.skillId)),
    ).toStrictEqual([skills.lower, skills.higher]);
  });

  it("still lists the skill linked first when the links were made at different times", async () => {
    freezeClock();

    const [skills, { chapterId, lessonId }] = await Promise.all([
      twoSkills("Simplifying fractions"),
      lessonInChapter("Simplifying fractions"),
    ]);

    // The earlier link decides, whatever the ids say.
    await lessonSkillFixture({ lessonId, skillId: skills.higher });
    vi.setSystemTime(Date.now() + 1000);
    await lessonSkillFixture({ lessonId, skillId: skills.lower });

    const rows = await loadItemSkillRows({ chapterIds: [chapterId], lessonIds: [lessonId] });

    expect({
      byChapter: rows.chapterLessons.flatMap((row) =>
        row.lesson.skills.map((skill) => skill.skillId),
      ),
      byLesson: rows.lessonSkills.map((row) => row.skillId),
    }).toStrictEqual({
      byChapter: [skills.higher, skills.lower],
      byLesson: [skills.higher, skills.lower],
    });
  });
});
