import { generateLessonTutorial } from "@zoonk/ai/tasks/lessons/tutorial";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateTutorialContentStep } from "./generate-tutorial-content-step";

vi.mock("@zoonk/ai/tasks/lessons/tutorial", () => ({
  generateLessonTutorial: vi
    .fn()
    .mockResolvedValue({ data: { steps: [{ text: "Open settings.", title: "Settings" }] } }),
}));

describe(generateTutorialContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates tutorial steps from the tutorial task", async () => {
    const context = await createLessonContext({ kind: "tutorial", organizationId });

    const result = await generateTutorialContentStep(context);

    expect(result).toEqual({ steps: [{ text: "Open settings.", title: "Settings" }] });
    expect(generateLessonTutorial).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonDescription: context.description,
        lessonTitle: context.title,
      }),
    );
  });
});
