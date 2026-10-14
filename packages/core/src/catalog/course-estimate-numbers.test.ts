import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { startCourseGoal } from "../goals/start-course-goal";
import { ensureQuickLessons } from "../library/quick-lessons/quick-lessons";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import {
  NUMBERS_DAYS,
  NUMBERS_NOW,
  estimateNumbersFixture,
} from "./_test-utils/estimate-numbers-fixture";
import { loadCourseEstimateData } from "./_utils/course-estimate-data";
import { estimateCoursePlan } from "./course-estimate";

describe("public course plan numbers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NUMBERS_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("distinguishes raw published content from the actual scheduled workload and weighted coverage", async () => {
    const { course } = await estimateNumbersFixture();

    const estimate = await estimateCoursePlan({
      courseId: course.id,
      dailyMinutes: 30,
      studyDays: NUMBERS_DAYS,
      targetDate: "2020-10-23",
    });

    if (!estimate || !("fittingLessons" in estimate)) {
      throw new Error("Expected dated estimate");
    }

    expect(estimate.publishedContent).toStrictEqual({ lessons: 20, minutes: 100 });

    expect(estimate.numbers.scheduledMinutes).toBe(
      Object.values(estimate.workload).reduce((sum, minutes) => sum + minutes, 0),
    );

    expect(estimate.numbers.scheduledMinutes).toBeGreaterThan(estimate.publishedContent.minutes);
    expect(estimate.numbers.beforeDeadlineMinutes).toBe(estimate.numbers.scheduledMinutes);
    expect(estimate.numbers.afterDeadlineMinutes).toBe(0);

    expect(estimate.numbers.availableBeforeDeadlineMinutes).toBeGreaterThanOrEqual(
      estimate.numbers.beforeDeadlineMinutes!,
    );

    expect(estimate.numbers.coverage?.measure).toBe("exam");
    expect(estimate.numbers.coverage?.coveredShare).toBeLessThan(1);

    expect(estimate.numbers.coverage?.coveredShare).not.toBe(
      estimate.fittingLessons / estimate.publishedContent.lessons,
    );

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
  });

  it("agrees with the started plan when date, level, pace and study days are the same", async () => {
    const [{ course }, user] = await Promise.all([estimateNumbersFixture(), userFixture()]);
    const input = { dailyMinutes: 30, studyDays: NUMBERS_DAYS, targetDate: "2020-10-23" };
    const estimate = await estimateCoursePlan({ ...input, courseId: course.id });
    mockSession(user.id);

    const started = await startCourseGoal({
      courseId: course.id,
      input: { ...input, level: "none", timeZone: "UTC" },
    });

    if (started.status !== "created" || !estimate) {
      throw new Error("Expected course start and estimate");
    }

    const data = await loadCourseEstimateData(course.id, "2020-09-28");

    if (!data) {
      throw new Error("Expected reused published curriculum");
    }

    await createGoalPlan({ goalId: started.goal.id, graph: data.sourceGraph });
    const result = await getGoalPlan(started.goal.id);

    if (result.status !== "ready") {
      throw new Error("Expected actual plan");
    }

    expect(result.plan.numbers).toBeDefined();
    expect(result.plan.numbers).toStrictEqual(estimate.numbers);
  });

  it.each([true, false])(
    "explains zero original lessons with positive quick or unwritten work (written %s)",
    async (written) => {
      const fixture = await estimateNumbersFixture({
        includeUnwritten: false,
        lessonsPerChapter: 12,
        names: ["Math", "Science"],
      });

      const base = fixture.skills[0]!;
      const target = fixture.skills[1]!;

      await Promise.all([
        prisma.skillPrerequisite.create({ data: { prerequisiteId: base.id, skillId: target.id } }),
        prisma.examSkillGraph.update({
          data: {
            graph: {
              ...fixture.graph,
              skills: fixture.graph.skills.map((skill, index) =>
                index === 0 ? { ...skill, topics: [] } : skill,
              ),
            },
          },
          where: { examBlueprintId: fixture.blueprint.id },
        }),
      ]);

      if (written) {
        const quickLessons = await ensureQuickLessons({ skillIds: [base.id] });
        const quick = quickLessons.get(base.id)!;

        await prisma.lesson.update({
          data: { estimatedMinutes: 2 },
          where: { id: quick.lessonId },
        });
      }

      const estimate = await estimateCoursePlan({
        courseId: fixture.course.id,
        dailyMinutes: 15,
        studyDays: NUMBERS_DAYS,
        targetDate: "2020-10-07",
      });

      if (!estimate || !("fittingLessons" in estimate)) {
        throw new Error("Expected dated estimate");
      }

      const area = estimate.areas.find((row) => row.area === "Math")!;
      expect(area.fitting).toBe(0);
      expect(area.plannedMinutes).toBeGreaterThan(0);
      expect(written ? area.quickLessons : area.unwrittenMinutes).toBeGreaterThan(0);

      expect(estimate.numbers.scheduledMinutes).toBe(
        Object.values(estimate.workload).reduce((sum, minutes) => sum + minutes, 0),
      );

      expect(
        estimate.chapters.find((chapter) => chapter.chapterId === fixture.chapters[0]!.chapter.id)
          ?.workKinds,
      ).toContain(written ? "quick" : "unwritten");
    },
  );
});
