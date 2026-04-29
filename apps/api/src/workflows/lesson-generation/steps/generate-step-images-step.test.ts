import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateStepImages } from "./_utils/generate-step-images";
import { generateStepImagesStep } from "./generate-step-images-step";

vi.mock("./_utils/generate-step-images", () => ({
  generateStepImages: vi.fn().mockResolvedValue([
    { prompt: "first prompt", url: "https://example.com/first.webp" },
    { prompt: "second prompt", url: "https://example.com/second.webp" },
  ]),
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

  test("delegates content image generation with lesson language and organization", async () => {
    const context = await createLessonContext({ organizationId });

    const result = await generateStepImagesStep({
      context,
      preset: "practice",
      prompts: ["first prompt", "second prompt"],
    });

    expect(result.images).toEqual([
      { prompt: "first prompt", url: "https://example.com/first.webp" },
      { prompt: "second prompt", url: "https://example.com/second.webp" },
    ]);
    expect(generateStepImages).toHaveBeenCalledExactlyOnceWith({
      language: context.language,
      orgSlug: "ai",
      preset: "practice",
      prompts: ["first prompt", "second prompt"],
    });
  });
});
