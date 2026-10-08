import { describe, expect, it } from "vitest";
import {
  completeFill,
  fillShare,
  genotypeOptions,
  nextEmptyCell,
  punnettCells,
  traitCounts,
} from "./punnett-model";

const parents = [
  { alleles: ["P", "p"], label: "Purple" },
  { alleles: ["p", "p"], label: "White" },
];

describe(punnettCells, () => {
  it("pairs each row allele of the first parent with each column allele of the second", () => {
    expect(punnettCells(parents).map((cell) => cell.row + cell.column)).toStrictEqual([
      "Pp",
      "Pp",
      "pp",
      "pp",
    ]);
  });
});

describe(genotypeOptions, () => {
  it("offers the three genotypes of the gene, dominant first", () => {
    expect(genotypeOptions(parents)).toStrictEqual(["PP", "Pp", "pp"]);

    expect(genotypeOptions([{ alleles: ["r", "R"], label: "Round" }])).toStrictEqual([
      "RR",
      "Rr",
      "rr",
    ]);
  });
});

describe(nextEmptyCell, () => {
  it("moves to the next empty square, wrapping around", () => {
    expect(nextEmptyCell([null, null, null, null], null)).toBe(0);
    expect(nextEmptyCell(["Pp", null, "pp", null], 1)).toBe(3);
    expect(nextEmptyCell([null, "Pp", "pp", "pp"], 3)).toBe(0);
    expect(nextEmptyCell(["Pp", "Pp", "pp", "pp"], 0)).toBeNull();
  });
});

describe(fillShare, () => {
  it("counts the squares a check reads, once the square is full", () => {
    const fill = ["Pp", "Pp", "pp", "pp"];

    expect(fillShare(fill, "recessive")).toBe(0.5);
    expect(fillShare(fill, "dominant")).toBe(0.5);
    expect(fillShare(fill, "pP")).toBe(0.5);
    expect(fillShare(["Pp", null, "pp", "pp"], "recessive")).toBeNull();
  });

  it("follows the learner's fill, even when it's wrong", () => {
    expect(fillShare(["PP", "PP", "PP", "pp"], "recessive")).toBe(0.25);
  });
});

describe(traitCounts, () => {
  it("counts the dominant and recessive traits among filled squares", () => {
    expect(traitCounts(["Pp", "PP", "pp", null])).toStrictEqual({ dominant: 2, recessive: 1 });
    expect(completeFill(["Pp", null])).toBeNull();
  });
});
