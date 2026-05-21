import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRomanizationLessonContext } from "./_test-utils/create-romanization-lesson-context";
import { generateVocabularyRomanizationStep } from "./generate-vocabulary-romanization-step";

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve({
        data: { romanizations: texts.map((text: string) => `${text} romanized`) },
      }),
    ),
}));

describe(generateVocabularyRomanizationStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates romanizations for vocabulary words", async () => {
    const context = createRomanizationLessonContext({ targetLanguage: "ja" });
    const catWord = "猫";
    const dogWord = "犬";
    const words = [catWord, dogWord];

    await expect(generateVocabularyRomanizationStep({ context, words })).resolves.toStrictEqual({
      romanizations: { [catWord]: `${catWord} romanized`, [dogWord]: `${dogWord} romanized` },
    });

    expect(generateLessonRomanization).toHaveBeenCalledWith({ targetLanguage: "ja", texts: words });
  });

  it("streams completion when romanization is skipped for Roman-script languages", async () => {
    const context = createRomanizationLessonContext({ targetLanguage: "es" });

    await expect(
      generateVocabularyRomanizationStep({ context, words: ["gato"] }),
    ).resolves.toStrictEqual({ romanizations: {} });

    expect(generateLessonRomanization).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toContainEqual({
      status: "completed",
      step: "generateVocabularyRomanization",
    });
  });
});
