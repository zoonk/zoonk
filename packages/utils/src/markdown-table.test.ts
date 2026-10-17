import { describe, expect, it } from "vitest";
import {
  findMarkdownTables,
  findRaggedTableRows,
  readMarkdownTable,
  removeMarkdownTables,
} from "./markdown-table";

const TEXT = [
  "Ofícios recebidos:",
  "| Mês | Recebidos |",
  "| --- | ---: |",
  "| Maio | 40 |",
  "| Junho | 30 | 9 |",
  "",
  "Qual mês teve menos?",
].join("\n");

describe(readMarkdownTable, () => {
  it("reads a table's header, alignment and rows, padding or dropping cells like GFM", () => {
    expect(readMarkdownTable(TEXT.split("\n"), 1)).toStrictEqual({
      end: 5,
      table: {
        align: [null, "right"],
        header: ["Mês", "Recebidos"],
        rows: [
          ["Maio", "40"],
          ["Junho", "30"],
        ],
      },
    });

    expect(readMarkdownTable(TEXT.split("\n"), 0)).toBeNull();
  });
});

describe(findMarkdownTables, () => {
  it("finds every table in a text, and none in prose with a stray pipe", () => {
    expect(findMarkdownTables(TEXT)).toHaveLength(1);
    expect(findMarkdownTables("Escolha A | B.")).toStrictEqual([]);
  });
});

describe(findRaggedTableRows, () => {
  it("lists the rows written with more or fewer cells than the header", () => {
    expect(findRaggedTableRows(TEXT)).toStrictEqual(["| Junho | 30 | 9 |"]);
  });
});

describe(removeMarkdownTables, () => {
  it("keeps the prose around a table", () => {
    expect(removeMarkdownTables(TEXT)).toBe("Ofícios recebidos:\n\nQual mês teve menos?");
  });
});
