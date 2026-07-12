import { describe, expect, it } from "vitest";
import { buildSerializedStep } from "../../_test-utils/player-test-data";
import {
  getGrammarExplanationSentenceLines,
  isInitialGrammarExplanationStep,
} from "./grammar-explanation-lines";

describe(getGrammarExplanationSentenceLines, () => {
  it("puts each explanation sentence on its own display line", () => {
    expect(
      getGrammarExplanationSentenceLines(
        "Use el for masculine nouns. Use la for feminine nouns, e.g. la mesa. This matters!",
      ),
    ).toStrictEqual([
      "Use el for masculine nouns.",
      "Use la for feminine nouns, e.g. la mesa.",
      "This matters!",
    ]);
  });

  it("does not split at punctuation inside inline code", () => {
    expect(
      getGrammarExplanationSentenceLines(
        "Para fazer perguntas de sim ou não no passado, use `Did` + sujeito + verbo na forma base. O passado já está indicado por `Did`, então não use o verbo principal no passado: diga `Did she go?`, e não `Did she went?`.",
      ),
    ).toStrictEqual([
      "Para fazer perguntas de sim ou não no passado, use `Did` + sujeito + verbo na forma base.",
      "O passado já está indicado por `Did`, então não use o verbo principal no passado: diga `Did she go?`, e não `Did she went?`.",
    ]);
  });
});

describe(isInitialGrammarExplanationStep, () => {
  const firstExplanationStep = buildSerializedStep({ id: "explanation-1", position: 0 });

  const secondExplanationStep = buildSerializedStep({ id: "explanation-2", position: 1 });

  const grammarExampleStep = buildSerializedStep({
    content: {
      highlight: "corre",
      romanization: null,
      sentence: "Ella corre rapido",
      translation: "She runs fast",
      variant: "grammarExample" as const,
    },
    id: "grammar-example",
    position: 2,
  });

  const laterStaticStep = buildSerializedStep({ id: "later-static", position: 3 });

  const steps = [firstExplanationStep, secondExplanationStep, grammarExampleStep, laterStaticStep];

  it("matches every leading static text step in grammar lessons", () => {
    expect(
      isInitialGrammarExplanationStep({ lessonKind: "grammar", step: firstExplanationStep, steps }),
    ).toBe(true);

    expect(
      isInitialGrammarExplanationStep({
        lessonKind: "grammar",
        step: secondExplanationStep,
        steps,
      }),
    ).toBe(true);
  });

  it("does not match non-grammar lessons or static text after grammar examples", () => {
    expect(
      isInitialGrammarExplanationStep({
        lessonKind: "explanation",
        step: firstExplanationStep,
        steps,
      }),
    ).toBe(false);

    expect(
      isInitialGrammarExplanationStep({ lessonKind: "grammar", step: laterStaticStep, steps }),
    ).toBe(false);
  });
});
