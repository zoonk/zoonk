import { describe, expect, it } from "vitest";
import {
  findMarkdownTableLines,
  findMarkdownTables,
  findRaggedTableRows,
  mapTextCells,
  readMarkdownTable,
  readTextCells,
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

const AFTER_PIPE_LINE = [
  "Read P(rain | clouds) from the table below:",
  "| Sky | Rain |",
  "|---|---|",
  "| Clouds | 30% |",
  "| Clear | 5% | 2% |",
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

  it("finds a table right under a sentence with a pipe, as the players draw it", () => {
    expect(findMarkdownTables(AFTER_PIPE_LINE)).toHaveLength(1);
  });

  it("reads a body row that looks like a header as part of its table", () => {
    expect(findMarkdownTables("| a | b |\n|---|---|\n| c | d |\n|---|---|")).toHaveLength(1);
  });

  it("finds no table in code, which shows its pipes as written", () => {
    expect(findMarkdownTables("```text\n| a | b |\n|---|---|\n| c | d |\n```")).toStrictEqual([]);
  });
});

describe(findMarkdownTableLines, () => {
  it("marks a table right under a sentence with a pipe, and not the sentence", () => {
    expect(findMarkdownTableLines(AFTER_PIPE_LINE.split("\n"))).toStrictEqual(
      new Set([1, 2, 3, 4]),
    );
  });
});

describe(findRaggedTableRows, () => {
  it("lists the rows written with more or fewer cells than the header", () => {
    expect(findRaggedTableRows(TEXT)).toStrictEqual(["| Junho | 30 | 9 |"]);
    expect(findRaggedTableRows(AFTER_PIPE_LINE)).toStrictEqual(["| Clear | 5% | 2% |"]);
  });
});

describe(removeMarkdownTables, () => {
  it("keeps the prose around a table", () => {
    expect(removeMarkdownTables(TEXT)).toBe("Ofícios recebidos:\n\nQual mês teve menos?");

    expect(removeMarkdownTables(AFTER_PIPE_LINE)).toBe(
      "Read P(rain | clouds) from the table below:",
    );
  });
});

const WITH_CODE = [
  "Veja | compare:",
  "| A | B |",
  "|---|---|",
  "| 1 | 2 |",
  "```sh",
  "a | b",
  "```",
].join("\n");

describe(readTextCells, () => {
  it("reads each line and table cell the player reads as text, leaving code out", () => {
    expect(readTextCells(WITH_CODE)).toStrictEqual([
      "Veja | compare:",
      "",
      " A ",
      " B ",
      "",
      "",
      "---",
      "---",
      "",
      "",
      " 1 ",
      " 2 ",
      "",
    ]);
  });
});

describe(mapTextCells, () => {
  it("rewrites text cell by cell and keeps table pipes and code as written", () => {
    expect(mapTextCells(WITH_CODE, (cell) => cell.toLowerCase())).toBe(
      ["veja | compare:", "| a | b |", "|---|---|", "| 1 | 2 |", "```sh", "a | b", "```"].join(
        "\n",
      ),
    );
  });
});
