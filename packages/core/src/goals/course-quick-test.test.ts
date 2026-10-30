import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { getCourseQuickTestMinutes } from "./course-quick-test";

function publicCourse(attrs: Parameters<typeof courseFixture>[0] = {}) {
  return courseFixture({ isPublished: true, visibility: "public", ...attrs });
}

describe(getCourseQuickTestMinutes, () => {
  it("times a language course's quick test as its level test, and other courses' as the placement", async () => {
    const courses = await Promise.all([
      publicCourse({ targetLanguage: "es" }),
      publicCourse(),
      publicCourse({ format: "exam" }),
    ]);

    await expect(
      Promise.all(courses.map((course) => getCourseQuickTestMinutes(course))),
    ).resolves.toStrictEqual([3, 2, 2]);
  });

  it("times a language course an exam is built on as that exam's placement, the goal starting it makes", async () => {
    const [course, blueprint] = await Promise.all([
      publicCourse({ targetLanguage: "es" }),
      examBlueprintFixture(),
    ]);

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: {},
        model: "test",
        primaryCourseId: course.id,
        promptVersion: "test",
        runId: randomUUID(),
      },
    });

    await expect(getCourseQuickTestMinutes(course)).resolves.toBe(2);
  });
});
