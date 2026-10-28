import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";

const DAY_MS = 86_400_000;

const SKILL_SIZE = 30;
const WRITTEN = 3;

describe("a topic whose lessons aren't written yet", () => {
  it("counts the lessons the plan teaches it after cutting what doesn't fit, wherever it shows", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: Array.from({ length: 4 }, () => ({
        area: "Biologia",
        lessons: WRITTEN,
        size: SKILL_SIZE,
      })),
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 5,
      targetDate: new Date(Date.now() + 60 * DAY_MS),
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const standIns = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: null, kind: "lesson", lessonId: null, planId: plan.id },
    });

    const saved = new Map(standIns.map((item) => [item.skillId, item.lessons ?? 0]));
    const left = SKILL_SIZE - WRITTEN;

    expect(standIns.length).toBeGreaterThan(0);
    expect([...saved.values()].every((lessons) => lessons >= 1 && lessons < left)).toBe(true);

    const [viewed, syllabus] = await Promise.all([
      getGoalPlan(goal.id),
      getSyllabusView({ goalId: goal.id }),
    ]);

    const writingRows =
      viewed.status === "ready"
        ? viewed.plan.phases.flatMap((phase) => phase.chapters.filter((row) => row.writing))
        : [];

    expect(writingRows.reduce((sum, row) => sum + row.lessonsTotal, 0)).toBe(
      [...saved.values()].reduce((sum, lessons) => sum + lessons, 0),
    );

    const topicRows =
      syllabus.status === "ready"
        ? syllabus.syllabus.subjects.flatMap((subject) =>
            subject.chapters.filter((chapter) => chapter.writing),
          )
        : [];

    expect(topicRows.map((row) => row.lessonsTotal)).toStrictEqual(
      standIns.map((item) => item.lessons),
    );
  });
});
