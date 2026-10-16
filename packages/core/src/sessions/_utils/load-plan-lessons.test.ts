import { randomUUID } from "node:crypto";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { loadLessonsForSkills } from "./load-plan-lessons";

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
