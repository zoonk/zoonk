import { randomUUID } from "node:crypto";
import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateSentenceDistractorsStep } from "./generate-sentence-distractors-step";

vi.mock("@zoonk/ai/tasks/lessons/language/distractors", () => ({
  generateLessonDistractors: vi.fn().mockImplementation(({ language }) =>
    Promise.resolve({
      data: { distractors: language === "ja" ? ["火"] : ["dog"] },
    }),
  ),
}));

describe(generateSentenceDistractorsStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates sentence and translation distractors", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const catWord = `猫${uniqueId}`;
    const waterWord = `水${uniqueId}`;
    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      targetLanguage: "ja",
    });
    const sentences = [
      { explanation: "", sentence: `${catWord} ${waterWord}`, translation: "cat and water" },
    ];

    await expect(generateSentenceDistractorsStep({ context, sentences })).resolves.toEqual({
      distractors: { [`${catWord} ${waterWord}`]: ["火"] },
      translationDistractors: { "cat and water": ["dog"] },
    });
    expect(generateLessonDistractors).toHaveBeenCalledWith({
      input: `${catWord} ${waterWord}`,
      language: "ja",
      shape: "single-word",
    });
    expect(generateLessonDistractors).toHaveBeenCalledWith({
      input: "cat and water",
      language: "en",
      shape: "single-word",
    });
  });
});
