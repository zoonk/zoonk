import { describe, expect, it } from "vitest";
import { defaultDisplayName } from "./goal-display-name";

describe(defaultDisplayName, () => {
  it("uses a named exam, a capitalized subject, then the internal summary", () => {
    const goal = { kind: "exam" as const, language: "pt", title: "Prepare for an exam" };

    expect(defaultDisplayName({ ...goal, details: { examName: "  Receita Federal  " } })).toBe(
      "Receita Federal",
    );

    expect(defaultDisplayName({ ...goal, details: { examName: " " } })).toBe(goal.title);

    expect(
      defaultDisplayName({
        ...goal,
        details: { subject: "istanbul Turkish" },
        kind: "language",
        language: "tr",
      }),
    ).toBe("İstanbul Turkish");

    expect(
      defaultDisplayName({ ...goal, details: { subject: "e\u0301tica" }, kind: "learn" }),
    ).toBe("E\u0301tica");

    expect(defaultDisplayName({ ...goal, details: { subject: "Ignored" }, kind: "explain" })).toBe(
      goal.title,
    );
  });
});
