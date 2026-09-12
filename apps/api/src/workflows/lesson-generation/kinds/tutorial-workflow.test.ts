import { generateLessonTutorial } from "@zoonk/ai/tasks/lessons/tutorial";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
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
  generateStepImagePrompts: vi
    .fn()
    .mockResolvedValue({
      data: {
        images: [
          { alt: "A keyboard sends input to the processor.", prompt: "useful image", stepIndex: 1 },
        ],
      },
    }),
}));

vi.mock("@zoonk/core/steps/content-image", () => ({
  generateContentStepImage: vi
    .fn()
    .mockResolvedValue({ data: "https://example.com/selected.webp", error: null }),
}));

vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue({ runId: "illustration-run" }),
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

  it("stores complete tutorial steps and the selected illustration before resolving", async () => {
    const context = await createLessonContext({ kind: "tutorial", organizationId });

    await tutorialLessonWorkflow(context);

    expect(generateLessonTutorial).toHaveBeenCalledOnce();
    expect(generateStepImagePrompts).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(generateContentStepImage).toHaveBeenCalledOnce();

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    const contents = steps.map((step) => parseStepContent("static", step.content));

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([
      [0, "static"],
      [1, "static"],
    ]);

    expect(contents).toStrictEqual([
      { text: "Click settings", title: "Settings", variant: "text" },
      {
        image: {
          alt: "A keyboard sends input to the processor.",
          prompt: "useful image",
          url: "https://example.com/selected.webp",
        },
        text: "Save changes",
        title: "Save",
        variant: "text",
      },
    ]);
  });
});
