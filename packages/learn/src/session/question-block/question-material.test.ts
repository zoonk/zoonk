import { describe, expect, it } from "vitest";
import { getQuestionMaterial } from "./question-material";

const LONG = "A city that grows outward. ".repeat(20);

function question(overrides: Partial<Parameters<typeof getQuestionMaterial>[0]> = {}) {
  return { set: null, ...overrides };
}

describe(getQuestionMaterial, () => {
  it("is the set a question is on, half the screen for a long text", () => {
    expect(
      getQuestionMaterial(question({ set: { kind: "text", listening: null, text: LONG } })),
    ).toStrictEqual({ kind: "text", long: true });

    expect(
      getQuestionMaterial(
        question({ set: { kind: "chart", listening: null, text: "Sales by month" } }),
      ),
    ).toStrictEqual({ kind: "chart", long: false });
  });

  it("is a recording for a set read aloud, whatever its transcript's length", () => {
    expect(
      getQuestionMaterial(question({ set: { kind: "text", listening: {} as never, text: LONG } })),
    ).toStrictEqual({ kind: "audio", long: false });
  });

  it("is nothing for a question on its own, whose context stays above it in the column", () => {
    expect(getQuestionMaterial(question())).toBeNull();
  });
});
