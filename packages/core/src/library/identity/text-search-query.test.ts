import { describe, expect, it } from "vitest";
import {
  matchesSearchTerms,
  parseSearchTerms,
  toTsQuery,
  toWordTsQuery,
} from "./text-search-query";

describe(parseSearchTerms, () => {
  it("keeps words only, so terms can't inject query operators", () => {
    expect(parseSearchTerms(["C++ & (pointers) | !memory:*", "  ", "---"])).toStrictEqual([
      [["c"], ["pointers"], ["memory"]],
    ]);
  });

  it("adds the accentless spelling of accented words", () => {
    expect(parseSearchTerms(["Função Afim"])).toStrictEqual([[["função", "funcao"], ["afim"]]]);
  });

  it("searches terms that repeat after normalization once", () => {
    expect(parseSearchTerms(["Regra de três", "regra de tres", "proporção"])).toHaveLength(2);
  });

  it("caps words per term and the number of terms", () => {
    const [longTerm] = parseSearchTerms(["one two three four five six seven"]);

    expect(longTerm).toHaveLength(5);

    expect(parseSearchTerms(Array.from({ length: 30 }, (_, index) => `term${index}`))).toHaveLength(
      16,
    );
  });
});

describe(toTsQuery, () => {
  it("requires every word of a term and accepts any term", () => {
    expect(toTsQuery(parseSearchTerms(["função afim", "reta"]))).toBe(
      "((função | funcao) & afim) | (reta)",
    );
  });

  it("returns null when no term has a word", () => {
    expect(toTsQuery(parseSearchTerms(["", "?!"]))).toBeNull();
  });
});

describe(matchesSearchTerms, () => {
  const terms = parseSearchTerms(["percent off", "desconto"]);

  it("matches when every word of one term appears, ignoring accents and case", () => {
    expect(matchesSearchTerms({ terms, text: "Calculate the PERCENT you get off a price" })).toBe(
      true,
    );

    expect(
      matchesSearchTerms({ terms: parseSearchTerms(["funcao"]), text: "Gráfico da função afim" }),
    ).toBe(true);
  });

  it("doesn't match partial terms or parts of words", () => {
    expect(matchesSearchTerms({ terms, text: "Percentages of a whole" })).toBe(false);
    expect(matchesSearchTerms({ terms, text: "Descontos progressivos" })).toBe(false);
  });
});

describe(toWordTsQuery, () => {
  it("accepts any spelling of one word", () => {
    const [[word = []] = []] = parseSearchTerms(["Função"]);

    expect(toWordTsQuery(word)).toBe("(função | funcao)");
  });
});
