import { describe, expect, it } from "vitest";
import { AIR_FRYER_ITEM, OVEN_ITEM } from "./_test-utils/air-fryer-batch";
import { findKeyMismatch } from "./key-mismatch";

const STATEMENT = {
  context: null,
  difficulty: "medium",
  format: "trueFalse",
  image: null,
  isTrue: true,
  misconception: null,
  reason: "Art. 5º, III.",
  statement: "Ninguém será submetido a tratamento desumano e degradante.",
  visual: null,
} as const;

describe(findKeyMismatch, () => {
  it("drops the air fryer when the solver finds no right option", () => {
    expect(
      findKeyMismatch({
        item: AIR_FRYER_ITEM,
        solution: { format: "multipleChoice", picks: [], work: "1,2 × 0,5 × 25 × 0,80 = 12,00" },
      }),
    ).toBe("The solver found no right option: 1,2 × 0,5 × 25 × 0,80 = 12,00");
  });

  it("keeps an item whose keyed option the solver picks", () => {
    expect(
      findKeyMismatch({
        item: OVEN_ITEM,
        solution: { format: "multipleChoice", picks: [0], work: "20 kWh ÷ 1,5 ÷ 30 = 4/9 h" },
      }),
    ).toBeNull();
  });

  it("names both options when the solver picks another one", () => {
    expect(
      findKeyMismatch({
        item: OVEN_ITEM,
        solution: { format: "multipleChoice", picks: [1, 0], work: "Both." },
      }),
    ).toBe(
      'Keyed "26 minutos e 40 segundos", but the solver picked "24 minutos", "26 minutos e 40 segundos": Both.',
    );
  });

  it.each([
    { isTrue: true, reason: null },
    { isTrue: false, reason: "Keyed true, but the solver judged it false: Narrower." },
    { isTrue: null, reason: "The solver couldn't judge the statement: Narrower." },
  ])("compares a statement judged $isTrue with its key", ({ isTrue, reason }) => {
    expect(
      findKeyMismatch({
        item: STATEMENT,
        solution: { format: "trueFalse", isTrue, work: "Narrower." },
      }),
    ).toBe(reason);
  });

  it("drops an item the solver skipped", () => {
    expect(findKeyMismatch({ item: STATEMENT, solution: null })).toBe("The solver gave no answer.");
  });
});
