import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { findTermsUsedBeforeExplained } from "./term-order";

function explanation(text: string): WrittenScreen {
  return { exampleLineIdea: null, image: null, kind: "explanation", text, title: "Idea" };
}

function check(question: string, option = "Two"): WrittenScreen {
  return {
    context: null,
    image: null,
    kind: "check",
    options: [
      { isCorrect: true, reason: "Right.", text: option },
      { isCorrect: false, reason: "Not quite.", text: "Four" },
    ],
    question,
  };
}

function hook(question: string): WrittenScreen {
  return {
    image: null,
    kind: "hookGuess",
    options: [
      { isCorrect: true, text: "Yes" },
      { isCorrect: false, text: "No" },
    ],
    question,
    reveal: "Let's see.",
  };
}

describe(findTermsUsedBeforeExplained, () => {
  it("finds an abbreviation a hook uses before the screen that explains it", () => {
    expect(
      findTermsUsedBeforeExplained([
        hook("How much ATP is left from one glucose?"),
        explanation("**ATP** is the cell's energy currency, like coins for small purchases."),
        check("How much ATP is left?"),
      ]),
    ).toStrictEqual([{ introducedAt: 1, term: "ATP", usedAt: 0 }]);
  });

  it("finds a bold term an option uses before it's taught, plurals included", () => {
    expect(
      findTermsUsedBeforeExplained([
        check("Where does the electron sit?", "In orbitals around the nucleus"),
        explanation("An **orbital** is the region where an electron is likely to be."),
      ]),
    ).toStrictEqual([{ introducedAt: 1, term: "orbital", usedAt: 0 }]);
  });

  it("accepts terms explained first, and terms the lesson never explains", () => {
    expect(
      findTermsUsedBeforeExplained([
        explanation("**ATP** is the cell's energy currency."),
        check("How much ATP is left? On the ENEM, this comes up often."),
        explanation("NADH carries electrons, so ATP comes later."),
      ]),
    ).toStrictEqual([]);
  });
});
