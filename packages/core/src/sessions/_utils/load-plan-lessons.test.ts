import { randomUUID } from "node:crypto";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { loadDayPlanLessons, loadLessonsForSkills, loadPlanLessons } from "./load-plan-lessons";

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

    await lessonSkillFixture({ lessonId: higher, skillId: skill.id });
    await lessonSkillFixture({ lessonId: lower, skillId: skill.id });

    const reinforcement = await loadLessonsForSkills({ limit: 1, skillIds: [skill.id] });

    expect(reinforcement.map((lesson) => lesson.lessonId)).toStrictEqual([lower]);
  });

  it("still takes the lesson linked first when the links were made at different times", async () => {
    freezeClock();
    const { higher, lower, skill } = await skillWithLessons("Name organic compounds");

    await lessonSkillFixture({ lessonId: higher, skillId: skill.id });
    vi.setSystemTime(Date.now() + 1000);
    await lessonSkillFixture({ lessonId: lower, skillId: skill.id });

    const reinforcement = await loadLessonsForSkills({ limit: 1, skillIds: [skill.id] });

    expect(reinforcement.map((lesson) => lesson.lessonId)).toStrictEqual([higher]);
  });
});

describe(loadDayPlanLessons, () => {
  it("looks ahead past retained lessons and separates allocation from fill", async () => {
    const lessons = await Promise.all(
      Array.from({ length: 32 }, (_, index) =>
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

    const upcoming = await loadDayPlanLessons({
      dayMinutes: 30,
      fillItems: items.slice(31),
      keptLessonIds: new Set(lessons.slice(0, 30).map((lesson) => lesson.id)),
      learnItems: items.slice(0, 31),
    });

    expect(upcoming.lessons.map((lesson) => lesson.lessonId)).toStrictEqual(
      lessons.slice(30, 31).map((lesson) => lesson.id),
    );

    expect(upcoming.fillLessons.map((lesson) => lesson.lessonId)).toStrictEqual(
      lessons.slice(31).map((lesson) => lesson.id),
    );
  });

  it("reads nothing when the day keeps every lesson", async () => {
    const lessonId = randomUUID();

    const item = {
      chapterId: null,
      id: randomUUID(),
      kind: "lesson" as const,
      lessonId,
      phase: 0,
      scheduledFor: null,
      skillId: null,
    };

    const upcoming = await countDatabaseStatements(() =>
      loadDayPlanLessons({
        dayMinutes: 30,
        fillItems: [],
        keptLessonIds: new Set([lessonId]),
        learnItems: [item],
      }),
    );

    expect(upcoming).toStrictEqual({
      result: { fillLessons: [], lessons: [] },
      statements: 0,
      writes: 0,
    });
  });
});

describe("personal lesson minutes", () => {
  it.each([
    { factor: 0.5, minutes: 2 },
    { factor: 1, minutes: 3 },
    { factor: 2, minutes: 6 },
  ])("prices a raw three-minute lesson once at pace $factor", async ({ factor, minutes }) => {
    const lesson = await libraryLessonFixture({ estimatedMinutes: 3 });

    const [planned] = await loadPlanLessons({
      items: [
        {
          chapterId: null,
          id: null,
          kind: "lesson",
          lessonId: lesson.id,
          phase: 0,
          scheduledFor: null,
          skillId: null,
        },
      ],
      paceFactor: factor,
    });

    expect(planned?.minutes).toBe(minutes);
  });
});
