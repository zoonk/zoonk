import { describe, expect, it } from "vitest";
import { arrangeMatchColumns, explainMismatch } from "./match-pairs-columns";

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

describe(explainMismatch, () => {
  const { left, right } = arrangeMatchColumns(fields);
  const card = (cards: typeof left, text: string) => cards.find((item) => item.text === text)!;

  it("names the trap with its own reason, on either side", () => {
    expect(
      explainMismatch({ left: card(left, "embarazada"), right: card(right, "embarrassed") }),
    ).toStrictEqual({ reason: "Embarrassed is avergonzado.", trap: card(right, "embarrassed") });

    expect(
      explainMismatch({ left: card(left, "carpeta"), right: card(right, "bookstore") }),
    ).toStrictEqual({ reason: "Carpeta means folder.", trap: card(left, "carpeta") });
  });

  it("explains a mix-up of two pairs with the pair's reason, if it has one", () => {
    expect(
      explainMismatch({ left: card(left, "librería"), right: card(right, "success") }),
    ).toStrictEqual({ reason: "A library is biblioteca.", trap: null });

    expect(
      explainMismatch({ left: card(left, "éxito"), right: card(right, "pregnant") }),
    ).toStrictEqual({ reason: null, trap: null });
  });
});
