import { describe, expect, it } from "vitest";
import { arrangeMatchColumns } from "./match-pairs-columns";

const fields = {
  pairs: [
    { id: "a", left: "embarazada", right: "pregnant" },
    { id: "b", left: "éxito", right: "success" },
    { id: "c", left: "librería", right: "bookstore", why: "A library is biblioteca." },
  ],
};

describe(arrangeMatchColumns, () => {
  it("puts every pair in both columns, the same way on every load", () => {
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
    const twoPairs = { pairs: fields.pairs.slice(0, 2) };

    for (const candidate of [fields, twoPairs]) {
      const { left, right } = arrangeMatchColumns(candidate);
      const aligned = left.filter((card, index) => right[index]?.id === card.id);
      expect(aligned).toStrictEqual([]);
    }
  });
});
