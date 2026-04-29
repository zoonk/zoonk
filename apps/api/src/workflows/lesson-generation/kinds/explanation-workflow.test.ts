import { generateLessonExplanation } from "@zoonk/ai/tasks/lessons/core/explanation";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { explanationLessonWorkflow } from "./explanation-workflow";

vi.mock("@zoonk/ai/tasks/lessons/core/explanation", () => ({
  generateLessonExplanation: vi.fn().mockResolvedValue({
    data: {
      anchor: { text: "Apply the idea later.", title: "Anchor" },
      explanation: [
        { text: "Explain A", title: "A" },
        { text: "Explain B", title: "B" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: vi.fn().mockResolvedValue({
    data: { prompts: ["image prompt a", "image prompt b", "image prompt anchor"] },
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

describe(explanationLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("stores generated explanation text with generated images", async () => {
    const context = await createLessonContext({
      kind: "explanation",
      organizationId,
    });

    await explanationLessonWorkflow(context);

    expect(generateLessonExplanation).toHaveBeenCalledOnce();
    expect(generateStepImagePrompts).toHaveBeenCalledOnce();
    expect(generateContentStepImage).toHaveBeenCalledTimes(3);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });
    const contents = steps.map((step) => parseStepContent("static", step.content));

    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "static"],
      [2, "static"],
    ]);

    expect(contents).toEqual([
      {
        image: {
          prompt: "image prompt a",
          url: "https://example.com/image%20prompt%20a.webp",
        },
        text: "Explain A",
        title: "A",
        variant: "text",
      },
      {
        image: {
          prompt: "image prompt b",
          url: "https://example.com/image%20prompt%20b.webp",
        },
        text: "Explain B",
        title: "B",
        variant: "text",
      },
      {
        image: {
          prompt: "image prompt anchor",
          url: "https://example.com/image%20prompt%20anchor.webp",
        },
        text: "Apply the idea later.",
        title: "Anchor",
        variant: "text",
      },
    ]);
  });
});
