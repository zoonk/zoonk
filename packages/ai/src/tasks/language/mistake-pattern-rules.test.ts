import { describe, expect, it } from "vitest";
import {
  type MistakePattern,
  isWellFormedDrillQuestion,
  normalizeMistakePattern,
} from "./mistake-pattern-rules";

function drillQuestion(overrides: Partial<MistakePattern["drill"][number]> = {}) {
  return {
    answer: "since",
    feedback: "Use since with a starting point.",
    options: ["since", "for", "from"],
    sentence: "I've lived here ___ 2020.",
    translation: "Moro aqui desde 2020.",
    ...overrides,
  };
}

function pattern(overrides: Partial<MistakePattern> = {}): MistakePattern {
  return {
    contrast: [{ example: "since 2020", label: "since + quando começou" }],
    drill: [drillQuestion()],
    kind: "pattern",
    mistakeNumbers: [1, 3],
    rule: "Use since com o momento em que algo começou.",
    title: "since e for",
    ...overrides,
  };
}

describe(isWellFormedDrillQuestion, () => {
  it("accepts one blank with the answer among distinct options", () => {
    expect(isWellFormedDrillQuestion({ question: drillQuestion(), sameLanguage: false })).toBe(
      true,
    );
  });

  it("rejects a sentence without exactly one blank", () => {
    expect(
      isWellFormedDrillQuestion({
        question: drillQuestion({ sentence: "I've lived here 2020." }),
        sameLanguage: false,
      }),
    ).toBe(false);

    expect(
      isWellFormedDrillQuestion({
        question: drillQuestion({ sentence: "I ___ lived here ___ 2020." }),
        sameLanguage: false,
      }),
    ).toBe(false);
  });

  it("rejects an answer that isn't an option and repeated options", () => {
    expect(
      isWellFormedDrillQuestion({
        question: drillQuestion({ answer: "during" }),
        sameLanguage: false,
      }),
    ).toBe(false);

    expect(
      isWellFormedDrillQuestion({
        question: drillQuestion({ options: ["since", "for", "for"] }),
        sameLanguage: false,
      }),
    ).toBe(false);
  });

  it("needs a translation for a learner reading another language, and none for one reading the same", () => {
    expect(
      isWellFormedDrillQuestion({
        question: drillQuestion({ translation: " " }),
        sameLanguage: false,
      }),
    ).toBe(false);

    expect(isWellFormedDrillQuestion({ question: drillQuestion(), sameLanguage: true })).toBe(
      false,
    );

    expect(
      isWellFormedDrillQuestion({
        question: drillQuestion({ translation: "" }),
        sameLanguage: true,
      }),
    ).toBe(true);
  });

  it("treats accented forms as different options", () => {
    const question = drillQuestion({
      answer: "está",
      options: ["está", "esta", "es"],
      sentence: "La tienda ___ cerrada.",
    });

    expect(isWellFormedDrillQuestion({ question, sameLanguage: false })).toBe(true);
  });
});

describe(normalizeMistakePattern, () => {
  it("keeps valid mistake numbers once, in order", () => {
    const result = normalizeMistakePattern({
      mistakeCount: 4,
      pattern: pattern({ mistakeNumbers: [3, 1, 3, 9, 0, 1.5] }),
      sameLanguage: false,
    });

    expect(result.mistakeNumbers).toStrictEqual([1, 3]);
  });

  it("drops malformed drill questions and writes the blank the same way", () => {
    const result = normalizeMistakePattern({
      mistakeCount: 4,
      pattern: pattern({
        drill: [
          drillQuestion({ sentence: "I've lived here _____ 2020." }),
          drillQuestion({ answer: "x" }),
        ],
      }),
      sameLanguage: false,
    });

    expect(result.drill).toStrictEqual([drillQuestion()]);
  });

  it("turns a pattern that fewer than two mistakes show into none", () => {
    const result = normalizeMistakePattern({
      mistakeCount: 4,
      pattern: pattern({ mistakeNumbers: [2, 7] }),
      sameLanguage: false,
    });

    expect(result).toStrictEqual({
      contrast: [],
      drill: [],
      kind: "none",
      mistakeNumbers: [],
      rule: "",
      title: "",
    });
  });

  it("keeps no drill or contrast for typos", () => {
    const result = normalizeMistakePattern({
      mistakeCount: 4,
      pattern: pattern({ kind: "typos", mistakeNumbers: [1, 2] }),
      sameLanguage: false,
    });

    expect(result).toMatchObject({
      contrast: [],
      drill: [],
      kind: "typos",
      mistakeNumbers: [1, 2],
    });
  });

  it("empties everything for none", () => {
    const result = normalizeMistakePattern({
      mistakeCount: 4,
      pattern: pattern({ kind: "none" }),
      sameLanguage: false,
    });

    expect(result).toMatchObject({ drill: [], kind: "none", mistakeNumbers: [], title: "" });
  });
});
