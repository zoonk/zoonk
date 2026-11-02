import { describe, expect, it } from "vitest";
import { toChoiceOptionsFinding } from "./choice-options-finding";

const PAGE = "https://www.gov.br/inep/pt-br/enem/provas-e-gabaritos";
const searched = (url: string) => url.startsWith("https://www.gov.br/");

const raw = {
  board: "INEP",
  edition: " Enem 2025 ",
  options: 5,
  sourceTitle: "Provas e gabaritos",
  sourceUrl: PAGE,
  status: "found" as const,
};

const UNKNOWN = { board: null, edition: null, options: null, source: null, status: "unknown" };

describe(toChoiceOptionsFinding, () => {
  it("keeps the number of options with its source", () => {
    expect(toChoiceOptionsFinding({ board: "Inep", isSearched: searched, raw })).toStrictEqual({
      board: "INEP",
      edition: "Enem 2025",
      options: 5,
      source: { title: "Provas e gabaritos", url: PAGE },
      status: "found",
    });
  });

  it("drops a count that isn't a question's options or comes from nowhere", () => {
    const answers = [
      { ...raw, options: 1 },
      { ...raw, options: 4.5 },
      { ...raw, options: null },
      { ...raw, sourceUrl: "https://invented.example.org/page" },
      { ...raw, sourceUrl: null },
      { ...raw, status: "unknown" as const },
    ];

    expect(
      answers.map((answer) =>
        toChoiceOptionsFinding({ board: "Inep", isSearched: searched, raw: answer }),
      ),
    ).toStrictEqual(answers.map(() => UNKNOWN));
  });

  it("counts an edition another board ran only while the exam's board is unknown", () => {
    expect(toChoiceOptionsFinding({ board: "Cebraspe", isSearched: searched, raw }).status).toBe(
      "unknown",
    );

    expect(toChoiceOptionsFinding({ board: null, isSearched: searched, raw }).status).toBe("found");
  });
});
