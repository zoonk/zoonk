import { describe, expect, it } from "vitest";
import { isSameDocumentTitle } from "./title-match";

describe(isSameDocumentTitle, () => {
  it("matches a publisher's page title with the document's cover title", () => {
    expect(
      isSameDocumentTitle({
        found: "Edital nº 1 – Abertura – TCDF Analista Administrativo 2026",
        uploaded: "EDITAL Nº 1 – TCDF/ANACE, DE 8 DE JULHO DE 2026 – Analista Administrativo",
      }),
    ).toBe(true);
  });

  it("doesn't match another document of the same publisher", () => {
    expect(
      isSameDocumentTitle({
        found: "Resultado final da prova discursiva",
        uploaded: "Edital de abertura TCDF 2026",
      }),
    ).toBe(false);
  });

  it("never matches an empty title", () => {
    expect(isSameDocumentTitle({ found: "de", uploaded: "Edital" })).toBe(false);
  });
});
