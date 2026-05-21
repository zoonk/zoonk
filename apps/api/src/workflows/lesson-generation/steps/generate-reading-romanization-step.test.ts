import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRomanizationLessonContext } from "./_test-utils/create-romanization-lesson-context";
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates romanizations for reading sentences", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const catWord = `猫${uniqueId}`;
    const waterWord = `水${uniqueId}`;

    const context = createRomanizationLessonContext({ targetLanguage: "ja" });

    const sentence = `${catWord} ${waterWord}`;
    const sentences = [{ explanation: "", sentence, translation: "cat and water" }];

    await expect(generateReadingRomanizationStep({ context, sentences })).resolves.toStrictEqual({
      romanizations: { [sentence]: `${sentence} romanized` },
    });

    expect(generateLessonRomanization).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts: [sentence],
    });
  });

  it("streams completion when romanization is skipped for Roman-script languages", async () => {
    const context = createRomanizationLessonContext({ targetLanguage: "es" });

    await expect(
      generateReadingRomanizationStep({
        context,
        sentences: [
          { explanation: "", sentence: "el gato bebe agua", translation: "the cat drinks water" },
        ],
      }),
    ).resolves.toStrictEqual({ romanizations: {} });

    expect(generateLessonRomanization).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toContainEqual({
      status: "completed",
      step: "generateReadingRomanization",
    });
  });
});
