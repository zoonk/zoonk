import { generateLessonExplanation } from "@zoonk/ai/tasks/lessons/core/explanation";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
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

describe(explanationLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the workflow pending until selected artwork is saved", async () => {
    const context = await createLessonContext({ kind: "explanation", organizationId });
    const image = Promise.withResolvers<{ data: string; error: null }>();
    vi.mocked(generateContentStepImage).mockReturnValueOnce(image.promise);
    let completed = false;

    const workflow = explanationLessonWorkflow(context).then(() => {
      completed = true;
    });

    await vi.waitFor(() => expect(generateContentStepImage).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    await expect(prisma.step.count({ where: { lessonId: context.id } })).resolves.toBe(3);
    image.resolve({ data: "https://example.com/selected.webp", error: null });
    await workflow;
    expect(completed).toBe(true);
    expect(start).not.toHaveBeenCalled();
  });

  it("preserves readable text and schedules independent recovery after image failure", async () => {
    const context = await createLessonContext({ kind: "explanation", organizationId });

    vi.mocked(generateContentStepImage).mockRejectedValueOnce(
      new Error("Image provider unavailable"),
    );

    await explanationLessonWorkflow(context);
    await expect(prisma.step.count({ where: { lessonId: context.id } })).resolves.toBe(3);

    expect(start).toHaveBeenCalledExactlyOnceWith(expect.any(Function), [
      {
        alts: ["", "A keyboard sends input to the processor.", ""],
        context,
        prompts: ["", "useful image", ""],
      },
    ]);
  });

  it("returns without image work when the selector finds no instructional need", async () => {
    const context = await createLessonContext({ kind: "explanation", organizationId });

    vi.mocked(generateStepImagePrompts, { partial: true }).mockResolvedValueOnce({
      data: { images: [] },
    });

    await explanationLessonWorkflow(context);
    expect(generateContentStepImage).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("stores complete explanation text and the selected illustration before resolving", async () => {
    const context = await createLessonContext({ kind: "explanation", organizationId });

    await explanationLessonWorkflow(context);

    expect(generateLessonExplanation).toHaveBeenCalledOnce();
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
      [2, "static"],
    ]);

    expect(contents).toStrictEqual([
      { text: "Explain A", title: "A", variant: "text" },
      {
        image: {
          alt: "A keyboard sends input to the processor.",
          prompt: "useful image",
          url: "https://example.com/selected.webp",
        },
        text: "Explain B",
        title: "B",
        variant: "text",
      },
      { text: "Apply the idea later.", title: "Anchor", variant: "text" },
    ]);
  });
});
