import { describe, expect, it } from "vitest";
import { readStatementAnswer } from "./statement-answer";

describe(readStatementAnswer, () => {
  it("reads a statement's saved answer as true or false", () => {
    expect(readStatementAnswer({ answer: "true", format: "trueFalse" })).toBe(true);
    expect(readStatementAnswer({ answer: "false", format: "trueFalse" })).toBe(false);
  });

  it("keeps the words of a typed answer or an option that happen to be true or false", () => {
    expect(readStatementAnswer({ answer: "false", format: "typed" })).toBeNull();
    expect(readStatementAnswer({ answer: "true", format: "multipleChoice" })).toBeNull();
    expect(readStatementAnswer({ answer: "true", format: undefined })).toBeNull();
  });
});
