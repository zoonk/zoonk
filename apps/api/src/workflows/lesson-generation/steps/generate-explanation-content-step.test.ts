import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateLessonExplanation } from "@zoonk/ai/tasks/lessons/core/explanation";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateExplanationContentStep } from "./generate-explanation-content-step";

vi.mock("@zoonk/ai/tasks/lessons/core/explanation", () => ({
  generateLessonExplanation: vi
    .fn()
    .mockResolvedValue({
      data: {
        anchor: { text: "Apply the idea elsewhere.", title: "Transfer" },
        explanation: [{ text: "Concept explanation.", title: "Concept" }],
      },
    }),
}));

describe(generateExplanationContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates explanation steps and includes neighboring explanation titles", async () => {
    const context = await createLessonContext({
      organizationId,
      titlePrefix: `Explanation Content ${randomUUID()}`,
    });

    await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId,
      position: 2,
      title: "Sibling explanation",
    });

    const result = await generateExplanationContentStep(context);

    expect(result.steps).toStrictEqual([
      { text: "Concept explanation.", title: "Concept" },
      { text: "Apply the idea elsewhere.", title: "Transfer" },
    ]);
    expect(generateLessonExplanation).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonDescription: context.description,
        lessonTitle: context.title,
        otherLessonTitles: ["Sibling explanation"],
      }),
    );
    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "started", step: "generateExplanationContent" }),
        expect.objectContaining({ status: "completed", step: "generateExplanationContent" }),
      ]),
    );
  });

  it("throws when explanation generation fails", async () => {
    const context = await createLessonContext({ organizationId });
    vi.mocked(generateLessonExplanation).mockRejectedValueOnce(new Error("AI failure"));

    await expect(generateExplanationContentStep(context)).rejects.toThrow("AI failure");
  });
});
