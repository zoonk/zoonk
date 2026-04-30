import { generateStepImage } from "@zoonk/core/steps/image";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateQuizImagesStep } from "./generate-quiz-images-step";

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi
    .fn()
    .mockImplementation(({ prompt }) =>
      Promise.resolve({
        data: `https://example.com/${encodeURIComponent(prompt)}.webp`,
        error: null,
      }),
    ),
}));

describe(generateQuizImagesStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds generated image URLs to select-image quiz options only", async () => {
    const context = await createLessonContext({ kind: "quiz", organizationId });

    const result = await generateQuizImagesStep({
      context,
      questions: [
        {
          format: "selectImage",
          options: [
            { feedback: "yes", isCorrect: true, prompt: "correct prompt" },
            { feedback: "no", isCorrect: false, prompt: "wrong prompt" },
          ],
          question: "Pick the image.",
        },
        {
          context: "Text context",
          format: "multipleChoice",
          options: [{ feedback: "yes", isCorrect: true, text: "Answer" }],
          question: "Pick text.",
        },
      ],
    });

    expect(generateStepImage).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        format: "selectImage",
        options: [
          {
            feedback: "yes",
            isCorrect: true,
            prompt: "correct prompt",
            url: "https://example.com/correct%20prompt.webp",
          },
          {
            feedback: "no",
            isCorrect: false,
            prompt: "wrong prompt",
            url: "https://example.com/wrong%20prompt.webp",
          },
        ],
        question: "Pick the image.",
      },
      {
        context: "Text context",
        format: "multipleChoice",
        options: [{ feedback: "yes", isCorrect: true, text: "Answer" }],
        question: "Pick text.",
      },
    ]);
  });
});
