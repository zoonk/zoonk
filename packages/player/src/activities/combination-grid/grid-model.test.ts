import { describe, expect, it } from "vitest";
import {
  type GridFields,
  cellOptions,
  completeFill,
  fillShare,
  gridCells,
  nextEmptyCell,
  sameCell,
  traitCounts,
} from "./grid-model";

const punnett: GridFields = {
  columns: { label: "White parent", values: ["p", "p"] },
  rows: { label: "Purple parent", values: ["P", "p"] },
  rule: "alleles",
  title: "Flower color",
  traits: { dominant: "Purple", recessive: "White" },
};

const dice: GridFields = {
  columns: { label: "Second die", values: [1, 2] },
  rows: { label: "First die", values: [1, 2] },
  rule: "sum",
  title: "Two dice",
};

describe(gridCells, () => {
  it("pairs each row value with each column value, row by row", () => {
    expect(gridCells(punnett).map((cell) => cell.row + cell.column)).toStrictEqual([
      "Pp",
      "Pp",
      "pp",
      "pp",
    ]);

    expect(gridCells(dice).map((cell) => [cell.rowIndex, cell.columnIndex])).toStrictEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });
});

describe(cellOptions, () => {
  it("offers the three genotypes of one gene, dominant first, whatever letter it uses", () => {
    expect(cellOptions(punnett, [])).toStrictEqual(["PP", "Pp", "pp"]);

    const round = { ...punnett, rows: { label: "Round parent", values: ["r", "R"] } };
    expect(cellOptions(round, [])).toStrictEqual(["RR", "Rr", "rr"]);
  });

  it("offers every value the numbers combine to once, smallest first", () => {
    expect(cellOptions(dice, ["2", "3", "3", "4"])).toStrictEqual(["2", "3", "4"]);
    expect(cellOptions(dice, ["12", "4", "9"])).toStrictEqual(["4", "9", "12"]);
  });
});

describe(sameCell, () => {
  it("reads a genotype in either order, and a number as written", () => {
    expect(sameCell("pP", "Pp")).toBe(true);
    expect(sameCell("PP", "Pp")).toBe(false);
    expect(sameCell("7", " 7 ")).toBe(true);
    expect(sameCell("7", "8")).toBe(false);
  });
});

describe(nextEmptyCell, () => {
  it("moves to the next empty cell, wrapping around, and stops on a full grid", () => {
    expect(nextEmptyCell([null, null, null, null], null)).toBe(0);
    expect(nextEmptyCell(["Pp", null, "pp", null], 1)).toBe(3);
    expect(nextEmptyCell([null, "Pp", "pp", "pp"], 3)).toBe(0);
    expect(nextEmptyCell(["Pp", "Pp", "pp", "pp"], 0)).toBeNull();
  });
});

describe(fillShare, () => {
  it("counts the cells a check reads once the grid is full, as core does", () => {
    const fill = ["Pp", "Pp", "pp", "pp"];

    expect(fillShare(fill, "recessive")).toBe(0.5);
    expect(fillShare(fill, "dominant")).toBe(0.5);
    expect(fillShare(fill, "pP")).toBe(0.5);
    expect(fillShare(["2", "3", "3", "4"], "3")).toBe(0.5);
    expect(fillShare(["Pp", null, "pp", "pp"], "recessive")).toBeNull();
  });

  it("follows the learner's fill, even when it's wrong", () => {
    expect(fillShare(["PP", "PP", "PP", "pp"], "recessive")).toBe(0.25);
  });
});

describe(traitCounts, () => {
  it("counts the dominant and recessive traits among filled cells", () => {
    expect(traitCounts(["Pp", "PP", "pp", null])).toStrictEqual({ dominant: 2, recessive: 1 });
    expect(completeFill(["Pp", null])).toBeNull();
    expect(completeFill(["Pp", "pp"])).toStrictEqual(["Pp", "pp"]);
  });
});
