import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateDirectDistractors } from "./_utils/generate-direct-distractors";
import { generateSentenceDistractorsStep } from "./generate-sentence-distractors-step";

vi.mock("./_utils/generate-direct-distractors", () => ({
  generateDirectDistractors: vi
    .fn()
    .mockImplementation(({ entries }) =>
      Promise.resolve(
        Object.fromEntries(
          entries.map((entry: { key: string }) => [entry.key, [`${entry.key} alt`]]),
        ),
      ),
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
      distractors: { [`${catWord} ${waterWord}`]: [`${catWord} ${waterWord} alt`] },
      translationDistractors: { "cat and water": ["cat and water alt"] },
    });
    expect(generateDirectDistractors).toHaveBeenCalledTimes(2);
  });
});
