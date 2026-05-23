import { describe, expect, it } from "vitest";
import { formatSourceLessonsForPrompt } from "./source-lessons";

describe(formatSourceLessonsForPrompt, () => {
  it("formats source lesson titles and descriptions for prompt scope", () => {
    expect(
      formatSourceLessonsForPrompt([
        { description: "Use field notes to preserve context.", title: "Field notes" },
        { description: "Separate visible evidence from interpretation.", title: "Evidence" },
      ]),
    ).toBe(
      [
        "1. Field notes: Use field notes to preserve context.",
        "2. Evidence: Separate visible evidence from interpretation.",
      ].join("\n"),
    );
  });

  it("omits missing metadata instead of adding placeholder punctuation", () => {
    expect(
      formatSourceLessonsForPrompt([
        { description: "Use field notes to preserve context.", title: "" },
        { description: "", title: "Evidence" },
      ]),
    ).toBe(["1. Use field notes to preserve context.", "2. Evidence"].join("\n"));
  });
});
