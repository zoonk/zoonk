import { describe, expect, it } from "vitest";
import { getOptionMarks } from "./mock-keys";

describe(getOptionMarks, () => {
  it("numbers multiple-choice options and statements scored by right answers", () => {
    expect(getOptionMarks({ format: "multipleChoice", scoring: "irt" })).toBe("numbers");
    expect(getOptionMarks({ format: "trueFalse", scoring: "raw" })).toBe("numbers");
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
