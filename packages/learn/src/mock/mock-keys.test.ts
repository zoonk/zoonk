import { describe, expect, it } from "vitest";
import { countLetteredOptions, getOptionMarks, isFlagKeyFree } from "./mock-keys";

const options = (count: number) => Array.from({ length: count }, (_, index) => `Option ${index}`);

describe(getOptionMarks, () => {
  it("letters multiple-choice options and statements scored by right answers", () => {
    expect(getOptionMarks({ format: "multipleChoice", scoring: "irt" })).toBe("letters");
    expect(getOptionMarks({ format: "trueFalse", scoring: "raw" })).toBe("letters");
  });

  it("marks a statement with glyphs where a wrong answer cancels a right one", () => {
    expect(getOptionMarks({ format: "trueFalse", scoring: "net" })).toBe("glyphs");
  });

  it("marks nothing on an answer typed in a box", () => {
    expect(getOptionMarks({ format: "numeric", scoring: "raw" })).toBeNull();
    expect(getOptionMarks({ format: "typed", scoring: "raw" })).toBeNull();
    expect(getOptionMarks({ format: "essay", scoring: "irt" })).toBeNull();
  });
});

describe(countLetteredOptions, () => {
  it("counts a multiple-choice question's options", () => {
    const question = { format: "multipleChoice" as const, options: options(5) };
    expect(countLetteredOptions({ question, scoring: "irt" })).toBe(5);
  });

  it("counts a statement's true and false where they're lettered A and B", () => {
    const question = { format: "trueFalse" as const, options: null };
    expect(countLetteredOptions({ question, scoring: "raw" })).toBe(2);
    expect(countLetteredOptions({ question, scoring: "net" })).toBe(0);
  });

  it("counts none for a typed answer", () => {
    const question = { format: "typed" as const, options: null };
    expect(countLetteredOptions({ question, scoring: "raw" })).toBe(0);
  });
});

describe(isFlagKeyFree, () => {
  it("leaves F to Flag while no option is lettered F", () => {
    expect(isFlagKeyFree(0)).toBe(true);
    expect(isFlagKeyFree(5)).toBe(true);
  });

  it("keeps F for the sixth option when a question has one", () => {
    expect(isFlagKeyFree(6)).toBe(false);
    expect(isFlagKeyFree(9)).toBe(false);
  });
});
