import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "./_test-utils/plan-library";
import { bringBackMissedLessons } from "./bring-back-missed-lessons";
import { createGoalPlan } from "./create-goal-plan";
import { type PlanGraph } from "./planner/plan-state";

const NOW = new Date("2026-10-12T12:00:00Z");

async function courseChapter({ skillId, titles }: { skillId: string; titles: string[] }) {
  const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

  const lessons = await Promise.all(
    titles.map((title) =>
      libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapter.id, title }),
    ),
  );

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    chapterSkillFixture({ chapterId: chapter.id, skillId }),
    ...lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId }),
    ]),
  ]);

  return { course, lessons };
}

async function setup() {
  const user = await userFixture();
  const [known, missed] = await Promise.all([skillFixture(), skillFixture()]);
  const [prefix] = crypto.randomUUID().split("-");

  const [knownCourse, missedCourse] = await Promise.all([
    courseChapter({
      skillId: known.id,
      titles: [`Site map ${prefix}`, `Content groups ${prefix}`, `Labels ${prefix}`],
    }),
    courseChapter({
      skillId: missed.id,
      titles: [`Reading order ${prefix}`, `Visual weight ${prefix}`],
    }),
  ]);

  const [shared] = knownCourse.lessons;
  await lessonSkillFixture({ lessonId: shared?.id ?? "", skillId: missed.id });

  const graph: PlanGraph = {
    phases: [{ milestone: "Can design", name: "Basics" }],
    skills: [known, missed].map((skill, index) => ({
      area: "Design",
      courseIds: [index === 0 ? knownCourse.course.id : missedCourse.course.id],
      lessons: index === 0 ? 3 : 2,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      weight: null,
    })),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    settings: { startDate: "2026-10-12" },
    timezone: "UTC",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph });

  await prisma.planItem.updateMany({
    data: { completedAt: NOW, status: "testedOut" },
    where: { kind: "lesson", planId: plan.id },
  });

  return { goal, missed, plan, shared: shared?.id ?? "" };
}

describe(bringBackMissedLessons, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("brings back the lessons the plan teaches the missed topic, and leaves the others tested out", async () => {
    const { goal, missed, plan, shared } = await setup();

    await bringBackMissedLessons({
      goalId: goal.id,
      now: NOW,
      skillIds: [missed.id],
      timeZone: "UTC",
    });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id },
    });

    expect(items.find((item) => item.lessonId === shared)?.status).toBe("testedOut");

    expect(
      items.filter((item) => item.skillId === missed.id).map((item) => item.status),
    ).toStrictEqual(["todo", "todo"]);

    const positions = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      select: { position: true },
      where: { planId: plan.id },
    });

    expect(positions.map((item) => item.position)).toStrictEqual(
      positions.map((_, index) => index),
    );
  });
});
