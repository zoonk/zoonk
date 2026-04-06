import { describe, expect, test } from "vitest";
import { buildVisualCodeOutput } from "./code-annotations";

describe(buildVisualCodeOutput, () => {
  test("maps model annotations to 1-based code line numbers", () => {
    expect(
      buildVisualCodeOutput({
        annotations: [
          { lineContent: "const sum = a + b;", text: "This adds the two inputs." },
          { lineContent: "return sum;", text: "This returns the computed value." },
        ],
        code: ["function add(a, b) {", "  const sum = a + b;", "  return sum;", "}"].join("\n"),
        language: "typescript",
      }),
    ).toEqual({
      annotations: [
        { line: 2, text: "This adds the two inputs." },
        { line: 3, text: "This returns the computed value." },
      ],
      code: ["function add(a, b) {", "  const sum = a + b;", "  return sum;", "}"].join("\n"),
      language: "typescript",
    });
  });

  test("falls back to a substring match when indentation changes", () => {
    expect(
      buildVisualCodeOutput({
        annotations: [{ lineContent: "console.log(total)", text: "Logs the total." }],
        code: ["if (ready) {", "  console.log(total);", "}"].join("\n"),
        language: "javascript",
      }),
    ).toEqual({
      annotations: [{ line: 2, text: "Logs the total." }],
      code: ["if (ready) {", "  console.log(total);", "}"].join("\n"),
      language: "javascript",
    });
  });
});
