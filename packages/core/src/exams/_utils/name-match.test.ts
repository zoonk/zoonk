import { describe, expect, it } from "vitest";
import { nameOverlap, namesMatch } from "./name-match";

describe(namesMatch, () => {
  it("matches official area names with their short forms", () => {
    expect(namesMatch("Math", "Mathematics and its Technologies")).toBe(true);
    expect(namesMatch("Matemática", "Matemática e suas Tecnologias")).toBe(true);
    expect(namesMatch("Languages", "Languages, Codes and their Technologies")).toBe(true);
  });

  it("matches an area to a section that covers it among others", () => {
    expect(namesMatch("Natural Sciences", "Natural Sciences and Math")).toBe(true);
    expect(namesMatch("Math", "Natural Sciences and Math")).toBe(true);
    expect(namesMatch("Ciências Humanas", "Linguagens, Ciências Humanas e redação")).toBe(true);
  });

  it("doesn't match areas that only share a word", () => {
    expect(namesMatch("Ciências da Natureza", "Linguagens, Ciências Humanas e redação")).toBe(
      false,
    );

    expect(namesMatch("Humanities", "Natural Sciences and Math")).toBe(false);
    expect(namesMatch("Mat", "Mathematics")).toBe(false);
    expect(namesMatch("", "Math")).toBe(false);
  });
});

describe(nameOverlap, () => {
  it("is the share of the shorter name's words the longer one has", () => {
    expect(nameOverlap("Matemática", "Matemática e suas Tecnologias")).toBe(1);

    expect(
      nameOverlap(
        "Processo Legislativo e Regimentos Parlamentares",
        "Processo Legislativo e Regimento Interno da Câmara dos Deputados, Regimento Comum do Congresso Nacional",
      ),
    ).toBe(0.75);

    expect(nameOverlap("Direito Penal", "Direito Administrativo")).toBe(0.5);
    expect(nameOverlap("Ecologia", "Eletricidade")).toBe(0);
    expect(nameOverlap("", "Math")).toBe(0);
  });
});
