import { describe, expect, it } from "vitest";
import { mistakeFor, programWithEdits, sameOutput } from "./code-runner-program";

describe(programWithEdits, () => {
  it("replaces only the edited lines", () => {
    const starter = "total = 0\nfor n in range(1, 100):\n    total += n\nprint(total)";

    expect(programWithEdits(starter, { 2: "for n in range(1, 101):" })).toBe(
      "total = 0\nfor n in range(1, 101):\n    total += n\nprint(total)",
    );
  });
});

describe(sameOutput, () => {
  it("ignores trailing spaces and blank lines, like grading", () => {
    expect(sameOutput("5050\n", "5050")).toBe(true);
    expect(sameOutput("a  \nb", "a\nb")).toBe(true);
    expect(sameOutput("5050", "4950")).toBe(false);
  });
});

describe(mistakeFor, () => {
  it("finds the feedback for the output a likely mistake prints", () => {
    const mistakes = [{ feedback: "range stops before its end.", output: "4950" }];

    expect(mistakeFor("4950\n", mistakes)).toStrictEqual(mistakes[0]);
    expect(mistakeFor("5050\n", mistakes)).toBeNull();
  });
});
