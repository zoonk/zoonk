import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { MASTERY_LEVELS } from "../library/courses/course-levels";
import { loadCourseExam } from "./_utils/course-exam";
import { startCourseGoal } from "./start-course-goal";

const NOW = new Date("2020-09-28T12:00:00Z");

/**
 * Exam A's first discipline is the shared course, so A's graph stores it as its primary course.
 * Exam B teaches the same course but starts with another discipline, so B's graph only names it.
 */
async function primaryAndNamedCourse() {
  const [shared, other] = await Promise.all([
    courseFixture({ format: "core", isPublished: true, visibility: "public" }),
    courseFixture({ format: "core", isPublished: true, visibility: "public" }),
  ]);

  const bands = await courseBandsFixture({ courseId: shared.id, levels: MASTERY_LEVELS });

  const exams = await Promise.all(
    [
      { date: "2020-10-11", primaryCourseId: shared.id },
      { date: "2020-10-18", primaryCourseId: other.id },
    ].map(async ({ date, primaryCourseId }, index) => {
      const blueprint = await examBlueprintFixture({
        edition: {
          check: null,
          citations: [],
          dates: [
            {
              citation: { passage: "Exam day", sourceId: "notice" },
              date,
              kind: "exam",
              label: "Exam",
              startTime: null,
            },
          ],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: "UTC",
          year: 2020,
        },
        examDate: new Date(date),
        name: `Public exam ${index}`,
      });

      await prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: NOW,
          graph: {
            phases: [{ milestone: null, name: "Exam subjects" }],
            skills: bands.map((band) => ({
              area: shared.title,
              courseIds: [shared.id],
              lessons: 1,
              name: band.skill.name,
              phase: 0,
              skillId: band.skill.id,
              topics: [band.skill.name],
              weight: 1,
            })),
          },
          model: "fixture",
          primaryCourseId,
          promptVersion: "fixture",
          runId: "fixture",
        },
      });

      return blueprint;
    }),
  );

  return { exams, shared };
}

describe("a course one exam stores as primary and another names", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("resolves to no single exam, like a course two exams store or two exams name", async () => {
    const { shared } = await primaryAndNamedCourse();
    await expect(loadCourseExam(shared.id)).resolves.toBeNull();
  });

  it("starts the shared course as an undated course goal", async () => {
    const [{ shared }, user] = await Promise.all([primaryAndNamedCourse(), userFixture()]);
    mockSession(user.id);

    await expect(startCourseGoal({ courseId: shared.id, input: {} })).resolves.toMatchObject({
      goal: { examBlueprintId: null, kind: "learn", targetDate: null },
      status: "created",
    });
  });
});
