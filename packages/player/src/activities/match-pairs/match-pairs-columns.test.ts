import { describe, expect, it } from "vitest";
import { arrangeMatchColumns, solvedRows } from "./match-pairs-columns";

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
  it("puts only paired cards from an old exercise in the columns, the same way on every load", () => {
    const { left, right } = arrangeMatchColumns(fields);

    expect(left.map((card) => card.text).toSorted()).toStrictEqual(
      ["embarazada", "librería", "éxito"].toSorted(),
    );

    expect(right.map((card) => card.text).toSorted()).toStrictEqual(
      ["bookstore", "pregnant", "success"].toSorted(),
    );

    expect(arrangeMatchColumns(fields)).toStrictEqual({ left, right });
  });

  it("never lines a pair up side by side", () => {
    const twoPairs = {
      pairs: [
        { id: "a", left: "embarazada", right: "pregnant" },
        { id: "b", left: "éxito", right: "success" },
      ],
    };

    for (const candidate of [fields, twoPairs]) {
      const { left, right } = arrangeMatchColumns(candidate);
      const aligned = left.filter((card, index) => right[index]?.id === card.id);
      expect(aligned).toStrictEqual([]);
    }
  });
});

describe(solvedRows, () => {
  it("keeps the left column's order, and puts each pair in one row", () => {
    const columns = arrangeMatchColumns(fields);

    const partners: Record<string, string> = {
      embarazada: "pregnant",
      librería: "bookstore",
      éxito: "success",
    };

    expect(solvedRows(columns).map(({ left, right }) => [left.text, right.text])).toStrictEqual(
      columns.left.map((card) => [card.text, partners[card.text]]),
    );
  });
});
