import { generateLessonTutorial } from "@zoonk/ai/tasks/lessons/tutorial";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { tutorialLessonWorkflow } from "./tutorial-workflow";

vi.mock("@zoonk/ai/tasks/lessons/tutorial", () => ({
  generateLessonTutorial: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Click settings", title: "Settings" },
        { text: "Save changes", title: "Save" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: vi.fn().mockResolvedValue({
    data: { prompts: ["settings image prompt", "save image prompt"] },
  }),
}));

vi.mock("@zoonk/core/steps/content-image", () => ({
  generateContentStepImage: vi.fn().mockImplementation(({ prompt }) =>
    Promise.resolve({
      data: `https://example.com/${encodeURIComponent(prompt)}.webp`,
      error: null,
    }),
  ),
}));

describe(tutorialLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("stores generated tutorial steps with generated images", async () => {
    const context = await createLessonContext({
      kind: "tutorial",
      organizationId,
    });

    await tutorialLessonWorkflow(context);

    expect(generateLessonTutorial).toHaveBeenCalledOnce();
    expect(generateStepImagePrompts).toHaveBeenCalledOnce();
    expect(generateContentStepImage).toHaveBeenCalledTimes(2);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });
    const contents = steps.map((step) => parseStepContent("static", step.content));

    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "static"],
    ]);
    expect(contents).toEqual([
      {
        image: {
          prompt: "settings image prompt",
          url: "https://example.com/settings%20image%20prompt.webp",
        },
        text: "Click settings",
        title: "Settings",
        variant: "text",
      },
      {
        image: {
          prompt: "save image prompt",
          url: "https://example.com/save%20image%20prompt.webp",
        },
        text: "Save changes",
        title: "Save",
        variant: "text",
      },
    ]);
  });
});
