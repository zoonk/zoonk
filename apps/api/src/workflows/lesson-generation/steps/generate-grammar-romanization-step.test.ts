import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRomanizationLessonContext } from "./_test-utils/create-romanization-lesson-context";
import { generateGrammarRomanizationStep } from "./generate-grammar-romanization-step";

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve({
        data: { romanizations: texts.map((text: string) => `${text} romanized`) },
      }),
    ),
}));

describe(generateGrammarRomanizationStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates grammar sentence and option romanizations", async () => {
    const context = createRomanizationLessonContext({ targetLanguage: "ja" });

    const catWord = "猫";
    const dogWord = "犬";
    const grammarSentence = "猫がいます";

    const grammarContent = {
      examples: [{ highlight: catWord, sentence: grammarSentence }],
      exercises: [{ answer: catWord, distractors: [dogWord], template: "[BLANK]がいます" }],
    };

    const romanizations = await generateGrammarRomanizationStep({ context, grammarContent });

    expect(romanizations.romanizations).toStrictEqual({
      [catWord]: `${catWord} romanized`,
      [dogWord]: `${dogWord} romanized`,
      [grammarSentence]: `${grammarSentence} romanized`,
    });

    expect(generateLessonRomanization).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts: [grammarSentence, grammarSentence, catWord, dogWord],
    });
  });

  it("streams completion when romanization is skipped for Roman-script languages", async () => {
    const context = createRomanizationLessonContext({ targetLanguage: "es" });

    const grammarContent = {
      examples: [{ highlight: "gato", sentence: "Hay un gato" }],
      exercises: [{ answer: "gato", distractors: ["perro"], template: "Hay un [BLANK]" }],
    };

    await expect(
      generateGrammarRomanizationStep({ context, grammarContent }),
    ).resolves.toStrictEqual({ romanizations: null });

    expect(generateLessonRomanization).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toContainEqual({
      status: "completed",
      step: "generateGrammarRomanization",
    });
  });
});
