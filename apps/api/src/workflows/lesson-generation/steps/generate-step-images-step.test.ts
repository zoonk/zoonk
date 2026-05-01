import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateStepImagesStep } from "./generate-step-images-step";

vi.mock("@zoonk/core/steps/content-image", () => ({
  generateContentStepImage: vi
    .fn()
    .mockImplementation(({ prompt }) =>
      Promise.resolve({
        data: `https://example.com/${encodeURIComponent(prompt)}.webp`,
        error: null,
      }),
    ),
}));

describe(generateStepImagesStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates content images with lesson language and organization", async () => {
    const context = await createLessonContext({ organizationId });

    const result = await generateStepImagesStep({
      context,
      preset: "practice",
      prompts: ["first prompt", "second prompt"],
    });

    expect(result.images).toStrictEqual([
      { prompt: "first prompt", url: "https://example.com/first%20prompt.webp" },
      { prompt: "second prompt", url: "https://example.com/second%20prompt.webp" },
    ]);

    expect(generateContentStepImage).toHaveBeenCalledWith({
      language: context.language,
      orgSlug: "ai",
      preset: "practice",
      prompt: "first prompt",
    });

    expect(generateContentStepImage).toHaveBeenCalledWith({
      language: context.language,
      orgSlug: "ai",
      preset: "practice",
      prompt: "second prompt",
    });
  });
});
