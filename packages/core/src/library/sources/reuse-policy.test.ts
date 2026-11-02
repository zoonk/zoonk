import { describe, expect, it } from "vitest";
import { getKnownReusePolicy } from "./reuse-policy";

describe(getKnownReusePolicy, () => {
  it("allows ENEM questions with a citation, found by INEP's domain", () => {
    const policy = getKnownReusePolicy({
      url: "https://download.inep.gov.br/enem/provas_e_gabaritos/2025_PV_impresso_D1_CD1.pdf",
    });

    expect(policy?.pastQuestions).toBe("allowedWithCitation");
  });

  it("allows Brazilian board questions with a citation and honors takedowns", () => {
    const policy = getKnownReusePolicy({ publisher: "Cebraspe", url: null });

    expect(policy).toMatchObject({ honorTakedowns: true, pastQuestions: "allowedWithCitation" });
  });

  it("matches a board's subdomain and its name with accents", () => {
    expect(
      getKnownReusePolicy({ url: "https://conhecimento.fgv.br/concursos/oab" }),
    ).not.toBeNull();

    expect(getKnownReusePolicy({ publisher: "Fundação Getúlio Vargas" })?.pastQuestions).toBe(
      "allowedWithCitation",
    );
  });

  it("never quotes SAT questions", () => {
    const policy = getKnownReusePolicy({ url: "https://satsuite.collegeboard.org/sat" });

    expect(policy?.pastQuestions).toBe("notAllowed");
  });

  it("returns null for unknown boards so items stay original", () => {
    const policy = getKnownReusePolicy({
      publisher: "Kultusministerium Baden-Württemberg",
      url: "https://km-bw.de/abitur",
    });

    expect(policy).toBeNull();
  });

  it("doesn't match a board's short name inside another word", () => {
    expect(getKnownReusePolicy({ publisher: "Instituto AFCCX" })).toBeNull();
    expect(getKnownReusePolicy({ url: "https://notfgv.br.example.com" })).toBeNull();
  });
});
