import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NUMBERS_DAYS,
  NUMBERS_NOW,
  estimateNumbersFixture,
} from "../catalog/_test-utils/estimate-numbers-fixture";
import { estimateCoursePlan } from "../catalog/course-estimate";
import { loadCourseExam } from "./_utils/course-exam";

describe("explicit course exam links", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NUMBERS_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("resolves an explicitly linked whole exam despite a shared ambiguous question bank", async () => {
    const fixture = await estimateNumbersFixture();
    const other = await examBlueprintFixture();
    await itemFixture({ examBlueprintId: other.id, skillId: fixture.skills[0]!.id });
    await itemFixture({ examBlueprintId: fixture.blueprint.id, skillId: fixture.skills[0]!.id });

    const subject = await courseFixture({ isPublished: true, visibility: "public" });

    await prisma.examSkillGraph.update({
      data: {
        graph: {
          ...fixture.graph,
          skills: fixture.graph.skills.map((skill) => ({ ...skill, courseIds: [subject.id] })),
        },
      },
      where: { examBlueprintId: fixture.blueprint.id },
    });

    const exam = await loadCourseExam(fixture.course.id);
    expect(exam?.blueprint.id).toBe(fixture.blueprint.id);
    expect(exam?.graph.skills).toHaveLength(fixture.graph.skills.length);

    const estimate = await estimateCoursePlan({
      courseId: fixture.course.id,
      dailyMinutes: 30,
      studyDays: NUMBERS_DAYS,
      targetDate: "2020-10-23",
    });

    if (!estimate || !("areas" in estimate)) {
      throw new Error("Expected an estimate of the linked whole exam");
    }

    expect(new Set(estimate.areas.map((area) => area.area))).toStrictEqual(
      new Set(["Math", "Science", "Languages", "Humanities", "Essay"]),
    );

    expect(estimate.numbers.scheduledMinutes).toBeGreaterThan(0);
  });

  it("keeps a subject's explicit graph link when the umbrella is the primary course", async () => {
    const [fixture, subject] = await Promise.all([
      estimateNumbersFixture(),
      courseFixture({ format: "core", isPublished: true, visibility: "public" }),
    ]);

    await courseChapterFixture({
      chapterId: fixture.chapters[0]!.chapter.id,
      courseId: subject.id,
    });

    await prisma.examSkillGraph.update({
      data: {
        graph: {
          ...fixture.graph,
          skills: fixture.graph.skills.map((skill, index) => ({
            ...skill,
            courseIds: [index === 0 ? subject.id : fixture.course.id],
          })),
        },
      },
      where: { examBlueprintId: fixture.blueprint.id },
    });

    const exam = await loadCourseExam(subject.id);
    expect(exam?.blueprint.id).toBe(fixture.blueprint.id);
  });

  it("keeps a bank-only exam course unlinked when two exams share its skills", async () => {
    const [fixture, course, other] = await Promise.all([
      estimateNumbersFixture(),
      courseFixture({ format: "exam", isPublished: true, visibility: "public" }),
      examBlueprintFixture(),
    ]);

    await courseChapterFixture({ chapterId: fixture.chapters[0]!.chapter.id, courseId: course.id });

    await Promise.all([
      itemFixture({ examBlueprintId: fixture.blueprint.id, skillId: fixture.skills[0]!.id }),
      itemFixture({ examBlueprintId: other.id, skillId: fixture.skills[0]!.id }),
    ]);

    await expect(loadCourseExam(course.id)).resolves.toBeNull();
  });
});
