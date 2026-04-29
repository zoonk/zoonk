import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { generateReadingRomanizationStep } from "./generate-reading-romanization-step";

vi.mock("./_utils/generate-lesson-romanizations", () => ({
  generateLessonRomanizations: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve(Object.fromEntries(texts.map((text: string) => [text, `${text} romanized`]))),
    ),
}));

describe(generateReadingRomanizationStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates romanizations for reading sentences", async () => {
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

    await expect(generateReadingRomanizationStep({ context, sentences })).resolves.toEqual({
      romanizations: {
        [`${catWord} ${waterWord}`]: `${catWord} ${waterWord} romanized`,
      },
    });
    expect(generateLessonRomanizations).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts: [`${catWord} ${waterWord}`],
    });
  });
});
