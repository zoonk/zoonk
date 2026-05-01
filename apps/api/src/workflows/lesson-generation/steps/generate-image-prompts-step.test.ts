import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateImagePromptsStep } from "./generate-image-prompts-step";

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: vi
    .fn()
    .mockResolvedValue({ data: { prompts: ["first prompt", "second prompt"] } }),
}));

describe(generateImagePromptsStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates image prompts for static lesson steps", async () => {
    const context = await createLessonContext({ organizationId });

    const steps = [
      { text: "First text", title: "First" },
      { text: "Second text", title: "Second" },
    ];

    const result = await generateImagePromptsStep({ context, steps });

    expect(result).toStrictEqual({ prompts: ["first prompt", "second prompt"] });

    expect(generateStepImagePrompts).toHaveBeenCalledWith(
      expect.objectContaining({ lessonDescription: context.description, steps }),
    );
  });

  it("skips image prompt generation when no steps exist", async () => {
    const context = await createLessonContext({ organizationId });

    const result = await generateImagePromptsStep({ context, steps: [] });

    expect(result).toStrictEqual({ prompts: [] });
    expect(generateStepImagePrompts).not.toHaveBeenCalled();
  });
});
