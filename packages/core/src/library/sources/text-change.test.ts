import { describe, expect, it } from "vitest";
import { summarizeTextChange } from "./text-change";

describe(summarizeTextChange, () => {
  it("lists removed and added lines", () => {
    expect(
      summarizeTextChange({
        current: "Edital 2026\nA prova terá 60 questões.\nInscrições até 10/10.",
        previous: "Edital 2026\nA prova terá 50 questões.\nInscrições até 10/10.",
      }),
    ).toBe("- A prova terá 50 questões.\n+ A prova terá 60 questões.");
  });

  it("ignores moved lines and whitespace", () => {
    expect(summarizeTextChange({ current: "  B\nA  \n\n", previous: "A\nB" })).toBeNull();
  });

  it("treats a first version as all added", () => {
    expect(summarizeTextChange({ current: "New rule", previous: null })).toBe("+ New rule");
  });
});
