import { describe, expect, test } from "vitest";
import { parseActivitySteps } from "./get-activity-steps";

describe(parseActivitySteps, () => {
  test("parses valid static text steps", () => {
    const steps = [
      { content: { text: "Content 1", title: "Step 1", variant: "text" } },
      { content: { text: "Content 2", title: "Step 2", variant: "text" } },
    ];

    const result = parseActivitySteps(steps);

    expect(result).toEqual([
      { text: "Content 1", title: "Step 1" },
      { text: "Content 2", title: "Step 2" },
    ]);
  });

  test("returns empty array for empty input", () => {
    expect(parseActivitySteps([])).toEqual([]);
  });

  test("throws when step content has grammarRule variant", () => {
    const steps = [
      { content: { ruleName: "Past tense", ruleSummary: "Summary", variant: "grammarRule" } },
    ];

    expect(() => parseActivitySteps(steps)).toThrow("Invalid static text step content");
  });
});
