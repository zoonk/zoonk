import { randomUUID } from "node:crypto";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { getCoursePromptByCourseSlug } from "./get-course-prompt-by-course";

describe(getCoursePromptByCourseSlug, () => {
  it("returns the earliest prompt linked to the matching AI course", async () => {
    const organization = await aiOrganizationFixture();
    const slug = `prompt-course-${randomUUID()}`;
    const course = await courseFixture({ language: "pt", organizationId: organization.id, slug });
    const firstPrompt = await coursePromptFixture({ courseId: course.id, language: "pt" });
    await coursePromptFixture({ courseId: course.id, language: "pt" });

    const result = await getCoursePromptByCourseSlug({ language: "pt", slug });

    expect(result?.id).toBe(firstPrompt.id);
  });

  it("does not return prompts for a course outside the public AI organization", async () => {
    const organization = await organizationFixture();
    const slug = `private-prompt-course-${randomUUID()}`;
    const course = await courseFixture({ organizationId: organization.id, slug });
    await coursePromptFixture({ courseId: course.id });

    await expect(getCoursePromptByCourseSlug({ language: "en", slug })).resolves.toBeNull();
  });
});
