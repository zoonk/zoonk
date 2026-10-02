import { describe, expect, it } from "vitest";
import { arrangeMatchColumns, mismatchReason } from "./match-pairs-columns";

const fields = {
  distractors: [
    { side: "right" as const, text: "embarrassed", why: "Embarrassed is avergonzado." },
    { side: "left" as const, text: "carpeta", why: "Carpeta means folder." },
  ],
  pairs: [
    { id: "a", left: "embarazada", right: "pregnant" },
    { id: "b", left: "éxito", right: "success" },
    { id: "c", left: "librería", right: "bookstore", why: "A library is biblioteca." },
  ],
};

describe(arrangeMatchColumns, () => {
  it("puts every pair and trap in the columns, the same way on every load", () => {
    const { left, right } = arrangeMatchColumns(fields);

    expect(left.map((card) => card.text).toSorted()).toStrictEqual(
      ["carpeta", "embarazada", "librería", "éxito"].toSorted(),
    );

    expect(right.map((card) => card.text).toSorted()).toStrictEqual(
      ["bookstore", "embarrassed", "pregnant", "success"].toSorted(),
    );

    expect(arrangeMatchColumns(fields)).toStrictEqual({ left, right });
  });

  it("never lines a pair up side by side", () => {
    const twoPairs = {
      distractors: [{ side: "right" as const, text: "embarrassed", why: "Looks alike." }],
      pairs: [
        { id: "a", left: "embarazada", right: "pregnant" },
        { id: "b", left: "éxito", right: "success" },
      ],
    };

    for (const candidate of [fields, twoPairs]) {
      const { left, right } = arrangeMatchColumns(candidate);
      const aligned = left.filter((card, index) => !card.isTrap && right[index]?.id === card.id);
      expect(aligned).toStrictEqual([]);
    }
  });
});

describe(mismatchReason, () => {
  it("explains a trap with its own reason, and a mix-up with the pair's", () => {
    const { left, right } = arrangeMatchColumns(fields);
    const pairs = left.filter((card) => !card.isTrap);
    const card = (cards: typeof left, text: string) => cards.find((item) => item.text === text)!;

    expect(
      mismatchReason({ left: card(left, "embarazada"), pairs, right: card(right, "embarrassed") }),
    ).toBe("Embarrassed is avergonzado.");

    expect(
      mismatchReason({ left: card(left, "librería"), pairs, right: card(right, "success") }),
    ).toBe("A library is biblioteca.");

    expect(
      mismatchReason({ left: card(left, "éxito"), pairs, right: card(right, "pregnant") }),
    ).toBeNull();
  });
});
