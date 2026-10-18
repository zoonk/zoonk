import { randomUUID } from "node:crypto";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { loadLessonsForSkills, loadUpcomingLessons } from "./load-plan-lessons";

/** A skill and two lessons of it, written one at a time with the higher id first. */
async function skillWithLessons(name: string) {
  const [lower = "", higher = ""] = [randomUUID(), randomUUID()].toSorted((a, b) =>
    a.localeCompare(b),
  );

  const skill = await skillFixture({ name });
  await libraryLessonFixture({ id: higher, title: `${name} 1` });
  await libraryLessonFixture({ id: lower, title: `${name} 2` });

  return { higher, lower, skill };
}

describe(loadLessonsForSkills, () => {
  it("takes the same lesson for a skill linked to lessons at one instant, whatever order the database returns", async () => {
    freezeClock();
    const { higher, lower, skill } = await skillWithLessons("Balance chemical equations");

    // Linked at one instant in reverse id order, as the lessons were written: a read in storage
    // order returns the lower id second.
    await lessonSkillFixture({ lessonId: higher, skillId: skill.id });
    await lessonSkillFixture({ lessonId: lower, skillId: skill.id });

    const reinforcement = await loadLessonsForSkills({ limit: 1, skillIds: [skill.id] });

    expect(reinforcement.map((lesson) => lesson.lessonId)).toStrictEqual([lower]);
  });

  it("still takes the lesson linked first when the links were made at different times", async () => {
    freezeClock();
    const { higher, lower, skill } = await skillWithLessons("Name organic compounds");

    // The earlier link decides, whatever the ids say.
    await lessonSkillFixture({ lessonId: higher, skillId: skill.id });
    vi.setSystemTime(Date.now() + 1000);
    await lessonSkillFixture({ lessonId: lower, skillId: skill.id });

    const reinforcement = await loadLessonsForSkills({ limit: 1, skillIds: [skill.id] });

    expect(reinforcement.map((lesson) => lesson.lessonId)).toStrictEqual([higher]);
  });
});

describe(loadUpcomingLessons, () => {
  // A day of many short lessons filled the lessons it looks ahead to with the ones it already held,
  // so the lessons that landed for it found no place and the day stayed short.
  it("looks ahead past the lessons the day keeps", async () => {
    const user = await userFixture();

    const lessons = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        libraryLessonFixture({ title: `Short lesson ${index + 1}` }),
      ),
    );

    const items = lessons.map((lesson) => ({
      chapterId: null,
      id: randomUUID(),
      kind: "lesson" as const,
      lessonId: lesson.id,
      phase: 0,
      scheduledFor: null,
      skillId: null,
      titleSnapshot: lesson.title,
    }));

    // A 30-minute day looks ahead to 8 lessons: the 8 it keeps would have been all of them.
    const upcoming = await loadUpcomingLessons({
      dayMinutes: 30,
      items,
      keptLessonIds: new Set(lessons.slice(0, 8).map((lesson) => lesson.id)),
      userId: user.id,
    });

    expect(upcoming.map((lesson) => lesson.lessonId)).toStrictEqual(
      lessons.slice(8).map((lesson) => lesson.id),
    );
  });
});
