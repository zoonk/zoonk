import { describe, expect, test } from "vitest";
import { splitHighlight } from "./highlight-text";

describe(splitHighlight, () => {
  test("splits text around matching substring", () => {
    const result = splitHighlight("She runs fast", "runs");
    expect(result).toEqual({ after: " fast", before: "She ", match: "runs" });
  });

  test("returns null match when highlight not found", () => {
    const result = splitHighlight("She runs fast", "walks");
    expect(result).toEqual({ after: "", before: "She runs fast", match: null });
  });

  test("handles highlight at the start of text", () => {
    const result = splitHighlight("runs fast", "runs");
    expect(result).toEqual({ after: " fast", before: "", match: "runs" });
  });

  test("handles highlight at the end of text", () => {
    const result = splitHighlight("She runs", "runs");
    expect(result).toEqual({ after: "", before: "She ", match: "runs" });
  });

  test("matches case-sensitively", () => {
    const result = splitHighlight("She Runs fast", "runs");
    expect(result).toEqual({ after: "", before: "She Runs fast", match: null });
  });

  test("matches only the first occurrence", () => {
    const result = splitHighlight("go go go", "go");
    expect(result).toEqual({ after: " go go", before: "", match: "go" });
  });

  test("handles empty highlight string", () => {
    const result = splitHighlight("Hello", "");
    expect(result).toEqual({ after: "", before: "Hello", match: null });
  });
});
