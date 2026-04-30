import { randomUUID } from "node:crypto";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateReadingRomanizationStep } from "./generate-reading-romanization-step";

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve({
        data: { romanizations: texts.map((text: string) => `${text} romanized`) },
      }),
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
    const sentence = `${catWord} ${waterWord}`;
    const sentences = [{ explanation: "", sentence, translation: "cat and water" }];

    await expect(generateReadingRomanizationStep({ context, sentences })).resolves.toEqual({
      romanizations: { [sentence]: `${sentence} romanized` },
    });
    expect(generateLessonRomanization).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts: [sentence],
    });
  });
});
