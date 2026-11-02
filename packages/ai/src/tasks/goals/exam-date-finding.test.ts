import { describe, expect, it } from "vitest";
import { toExamDateFinding } from "./exam-date-finding";

const TODAY = "2026-10-05";
const NOTICE = "https://cdn.cebraspe.org.br/concursos/camara_25/edital.pdf";

const searched = (url: string) => url.startsWith("https://cdn.cebraspe.org.br/");

describe(toExamDateFinding, () => {
  it("keeps an official day ahead with the page it came from, in date order", () => {
    expect(
      toExamDateFinding({
        isSearched: searched,
        raw: {
          dates: [
            { date: "2027-01-24", label: " Prova discursiva " },
            { date: "2027-01-17", label: "Prova objetiva" },
          ],
          sourceTitle: "Edital nº 1",
          sourceUrl: NOTICE,
          status: "official",
        },
        today: TODAY,
      }),
    ).toStrictEqual({
      dates: [
        { date: "2027-01-17", label: "Prova objetiva" },
        { date: "2027-01-24", label: "Prova discursiva" },
      ],
      source: { title: "Edital nº 1", url: NOTICE },
      status: "official",
    });
  });

  it("drops past or malformed days, and an exam left without a day isn't official", () => {
    expect(
      toExamDateFinding({
        isSearched: searched,
        raw: {
          dates: [
            { date: "2026-09-27", label: "Last year's test" },
            { date: "January 2027", label: "Test" },
          ],
          sourceTitle: "Edital",
          sourceUrl: NOTICE,
          status: "official",
        },
        today: TODAY,
      }),
    ).toStrictEqual({ dates: [], source: null, status: "unknown" });
  });

  it("never trusts a date from a page no search returned", () => {
    expect(
      toExamDateFinding({
        isSearched: searched,
        raw: {
          dates: [{ date: "2027-01-17", label: "Prova" }],
          sourceTitle: "Invented",
          sourceUrl: "https://example.com/edital.pdf",
          status: "official",
        },
        today: TODAY,
      }),
    ).toStrictEqual({ dates: [], source: null, status: "unknown" });
  });

  it("says a notice isn't out yet without any day", () => {
    expect(
      toExamDateFinding({
        isSearched: searched,
        raw: {
          dates: [{ date: "2027-03-01", label: "Expected" }],
          sourceTitle: null,
          sourceUrl: null,
          status: "notPublished",
        },
        today: TODAY,
      }),
    ).toStrictEqual({ dates: [], source: null, status: "notPublished" });
  });
});
