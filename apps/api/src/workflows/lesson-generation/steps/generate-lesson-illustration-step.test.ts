import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateLessonIllustrationStep } from "./generate-lesson-illustration-step";

vi.mock("@zoonk/core/steps/content-image", () => ({
  generateContentStepImage: vi
    .fn()
    .mockResolvedValue({ data: "https://example.com/image.webp", error: null }),
}));

describe(generateLessonIllustrationStep, () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds only the selected image, preserving readable content and reusing the saved image on retry", async () => {
    const organization = await aiOrganizationFixture();

    const context = await createLessonContext({
      generationRunId: "lesson-run",
      generationStatus: "completed",
      organizationId: organization.id,
    });

    const first = await stepFixture({
      content: { text: "Clear explanation", title: "An idea", variant: "text" },
      kind: "static",
      lessonId: context.id,
      position: 0,
    });

    const selected = await stepFixture({
      content: { text: "A useful example", title: "See the idea", variant: "text" },
      kind: "static",
      lessonId: context.id,
      position: 1,
    });

    const input = {
      alt: "A keyboard sends input to a processor.",
      context,
      prompt: "A useful concept illustration",
      stepIndex: 1,
    };

    await generateLessonIllustrationStep(input);
    await generateLessonIllustrationStep(input);
    expect(generateContentStepImage).toHaveBeenCalledOnce();

    const savedSnapshot1 = await prisma.step.findUniqueOrThrow({ where: { id: first.id } });

    expect(savedSnapshot1.content).toStrictEqual(first.content);

    const savedSnapshot2 = await prisma.step.findUniqueOrThrow({ where: { id: selected.id } });

    expect(savedSnapshot2.content).toMatchObject({
      ...(selected.content as object),
      image: { alt: input.alt, prompt: input.prompt, url: "https://example.com/image.webp" },
    });
  });

  it("does not spend on or attach an image from an old curriculum revision", async () => {
    const organization = await aiOrganizationFixture();
    const context = await createLessonContext({ organizationId: organization.id });

    const step = await stepFixture({
      content: { text: "Readable text", title: "Saved", variant: "text" },
      kind: "static",
      lessonId: context.id,
      position: 0,
    });

    await prisma.course.update({
      data: { contentRevision: { increment: 1 } },
      where: { id: context.chapter.courseId },
    });

    await generateLessonIllustrationStep({ context, prompt: "Stale art", stepIndex: 0 });
    expect(generateContentStepImage).not.toHaveBeenCalled();

    const savedSnapshot3 = await prisma.step.findUniqueOrThrow({ where: { id: step.id } });

    expect(savedSnapshot3.content).toStrictEqual(step.content);
  });
});
