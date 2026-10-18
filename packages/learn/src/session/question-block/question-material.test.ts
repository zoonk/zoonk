import { describe, expect, it } from "vitest";
import { getQuestionMaterial } from "./question-material";

const LONG = "A city that grows outward. ".repeat(20);

function question(overrides: Partial<Parameters<typeof getQuestionMaterial>[0]> = {}) {
  return { context: null, image: null, set: null, visual: null, ...overrides };
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

  it("is the question's own text, or its figure, without a set", () => {
    expect(getQuestionMaterial(question({ context: LONG }))).toStrictEqual({
      kind: "text",
      long: true,
    });

    expect(getQuestionMaterial(question({ image: { url: "x" } }))).toStrictEqual({
      kind: "figure",
      long: false,
    });
  });

  it("is nothing for a question with nothing to read first", () => {
    expect(getQuestionMaterial(question())).toBeNull();
  });
});
