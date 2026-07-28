import { randomUUID } from "node:crypto";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { describe, expect, it } from "vitest";
import { getCoursePromptById } from "./get-course-prompt";

describe(getCoursePromptById, () => {
  it("returns the persisted prompt and its linked course", async () => {
    const course = await courseFixture();
    const prompt = await coursePromptFixture({ courseId: course.id });

    const result = await getCoursePromptById({ id: prompt.id });

    expect(result).toMatchObject({ course: { id: course.id, slug: course.slug }, id: prompt.id });
  });

  it("returns null for missing and malformed prompt ids", async () => {
    await expect(getCoursePromptById({ id: randomUUID() })).resolves.toBeNull();
    await expect(getCoursePromptById({ id: "invalid-id" })).resolves.toBeNull();
  });
});
