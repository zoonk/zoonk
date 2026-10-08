import { describe, expect, it } from "vitest";
import {
  type MindMapStructure,
  listMindMapTexts,
  normalizeMindMapStructure,
} from "./mind-map-schema";

function branch(title: string): MindMapStructure["branches"][number] {
  return {
    drawing: "a leaf",
    explanation: `${title} explained.`,
    points: [" first ", "", "second", "third", "fourth"],
    title,
  };
}

const raw: MindMapStructure = {
  branches: ["One", "Two", "Three", "Four", "Five", "Six", "Seven"].map((title) => branch(title)),
  centralIdea: "Cells  do work — together.",
  comparison: { columns: [{ name: "Plant cell", points: ["Has a wall"] }], title: "Cell types" },
  summary: " Cells build and maintain life. ",
  title: "Cell structure",
};

describe(normalizeMindMapStructure, () => {
  it("keeps six branches of three points, trims text and drops a one-column comparison", () => {
    const structure = normalizeMindMapStructure(raw);

    expect(structure?.branches.map((item) => item.title)).toStrictEqual([
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
    ]);

    expect(structure?.branches[0]?.points).toStrictEqual(["first", "second", "third"]);
    expect(structure?.centralIdea).toBe("Cells do work, together.");
    expect(structure?.summary).toBe("Cells build and maintain life.");
    expect(structure?.comparison).toBeNull();
  });

  it("rejects a map with fewer than three branches or without a summary", () => {
    expect(normalizeMindMapStructure({ ...raw, branches: raw.branches.slice(0, 2) })).toBeNull();
    expect(normalizeMindMapStructure({ ...raw, summary: " " })).toBeNull();
  });
});

describe(listMindMapTexts, () => {
  it("lists the headings in the map's language and numbers the branches", () => {
    const structure = normalizeMindMapStructure({ ...raw, branches: raw.branches.slice(0, 3) });

    expect(structure && listMindMapTexts({ language: "pt", structure })).toStrictEqual([
      "Cell structure",
      "Ideia central",
      "Cells do work, together.",
      "1. One",
      "One explained.",
      "first",
      "second",
      "third",
      "2. Two",
      "Two explained.",
      "first",
      "second",
      "third",
      "3. Three",
      "Three explained.",
      "first",
      "second",
      "third",
      "Resumo: Cells build and maintain life.",
    ]);
  });
});
