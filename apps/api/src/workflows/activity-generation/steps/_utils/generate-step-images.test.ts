import { describe, expect, test, vi } from "vitest";
import { generateStepImages } from "./generate-step-images";

const { generateContentStepImageMock } = vi.hoisted(() => ({
  generateContentStepImageMock: vi.fn(),
}));

vi.mock("@zoonk/core/steps/content-image", () => ({
  generateContentStepImage: generateContentStepImageMock,
}));

describe(generateStepImages, () => {
  test("returns one uploaded image per prompt", async () => {
    generateContentStepImageMock
      .mockResolvedValueOnce({
        data: "https://example.com/step-1.webp",
        error: null,
      })
      .mockResolvedValueOnce({
        data: "https://example.com/step-2.webp",
        error: null,
      });

    const images = await generateStepImages({
      language: "en",
      orgSlug: "ai-org",
      prompts: ["Prompt 1", "Prompt 2"],
    });

    expect(images).toEqual([
      { prompt: "Prompt 1", url: "https://example.com/step-1.webp" },
      { prompt: "Prompt 2", url: "https://example.com/step-2.webp" },
    ]);
    expect(generateContentStepImageMock).toHaveBeenNthCalledWith(1, {
      language: "en",
      orgSlug: "ai-org",
      prompt: "Prompt 1",
    });
    expect(generateContentStepImageMock).toHaveBeenNthCalledWith(2, {
      language: "en",
      orgSlug: "ai-org",
      prompt: "Prompt 2",
    });
  });

  test("throws when image generation returns an error", async () => {
    generateContentStepImageMock.mockResolvedValueOnce({
      data: null,
      error: new Error("Image generation failed"),
    });

    await expect(
      generateStepImages({
        language: "en",
        prompts: ["Broken prompt"],
      }),
    ).rejects.toThrow("Image generation failed");
  });

  test("throws when image generation returns no URL", async () => {
    generateContentStepImageMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      generateStepImages({
        language: "en",
        prompts: ["Missing URL prompt"],
      }),
    ).rejects.toThrow("Image generation returned no URL for prompt: Missing URL prompt");
  });

  test("passes the requested image preset through to the generator", async () => {
    generateContentStepImageMock.mockResolvedValueOnce({
      data: "https://example.com/practice-step.webp",
      error: null,
    });

    await generateStepImages({
      language: "en",
      preset: "practice",
      prompts: ["Practice prompt"],
    });

    expect(generateContentStepImageMock).toHaveBeenCalledWith({
      language: "en",
      orgSlug: undefined,
      preset: "practice",
      prompt: "Practice prompt",
    });
  });
});
