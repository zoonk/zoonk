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

async function primaryAndNamedCourse() {
  const [shared, other] = await Promise.all([
    courseFixture({ format: "exam", isPublished: true, visibility: "public" }),
    courseFixture({ format: "exam", isPublished: true, visibility: "public" }),
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

describe("an exam course one exam owns and another names", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("resolves to the exam that owns it", async () => {
    const { exams, shared } = await primaryAndNamedCourse();
    const exam = await loadCourseExam(shared.id);
    expect(exam?.blueprint.id).toBe(exams[0]!.id);
  });

  it("starts the course as the owning exam's goal, with its date", async () => {
    const [{ exams, shared }, user] = await Promise.all([primaryAndNamedCourse(), userFixture()]);
    mockSession(user.id);

    await expect(startCourseGoal({ courseId: shared.id, input: {} })).resolves.toMatchObject({
      goal: { examBlueprintId: exams[0]!.id, kind: "exam", targetDate: "2020-10-11" },
      status: "created",
    });
  });
});
