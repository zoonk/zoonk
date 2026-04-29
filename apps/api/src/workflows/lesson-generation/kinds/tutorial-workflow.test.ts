import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateImagePromptsStep } from "../steps/generate-image-prompts-step";
import { generateStepImagesStep } from "../steps/generate-step-images-step";
import { generateTutorialContentStep } from "../steps/generate-tutorial-content-step";
import { saveTutorialLessonStep } from "../steps/save-static-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { tutorialLessonWorkflow } from "./tutorial-workflow";

vi.mock("../steps/generate-tutorial-content-step", () => ({
  generateTutorialContentStep: vi.fn().mockResolvedValue({
    steps: [
      { text: "Click settings", title: "Settings" },
      { text: "Save changes", title: "Save" },
    ],
  }),
}));

vi.mock("../steps/generate-image-prompts-step", () => ({
  generateImagePromptsStep: vi.fn().mockResolvedValue({
    prompts: ["image prompt a", "image prompt b"],
  }),
}));

vi.mock("../steps/generate-step-images-step", () => ({
  generateStepImagesStep: vi.fn().mockResolvedValue({
    images: [
      { prompt: "image prompt a", url: "https://example.com/a.webp" },
      { prompt: "image prompt b", url: "https://example.com/b.webp" },
    ],
  }),
}));

vi.mock("../steps/save-static-lesson-step", () => ({
  saveTutorialLessonStep: vi.fn(),
}));

describe(tutorialLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates tutorial content, images, and saves the static lesson", async () => {
    const context = await createKindWorkflowContext();

    await tutorialLessonWorkflow(context);

    expect(generateTutorialContentStep).toHaveBeenCalledExactlyOnceWith(context);
    expect(generateImagePromptsStep).toHaveBeenCalledExactlyOnceWith({
      context,
      steps: [
        { text: "Click settings", title: "Settings" },
        { text: "Save changes", title: "Save" },
      ],
    });
    expect(generateStepImagesStep).toHaveBeenCalledExactlyOnceWith({
      context,
      prompts: ["image prompt a", "image prompt b"],
    });
    expect(saveTutorialLessonStep).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        steps: [
          { text: "Click settings", title: "Settings" },
          { text: "Save changes", title: "Save" },
        ],
      }),
    );
  });
});
