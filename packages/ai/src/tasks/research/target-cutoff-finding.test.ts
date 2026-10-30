import { describe, expect, it } from "vitest";
import { toTargetCutoffFinding } from "./target-cutoff-finding";

const PAGE = "https://sisu.mec.gov.br/notas-de-corte/ufmg-medicina";
const searched = (url: string) => url.startsWith("https://sisu.mec.gov.br/");

const raw = {
  edition: " Sisu 2025 ",
  maxScore: 1000,
  quota: " ampla concorrência ",
  score: 790.8,
  sourceTitle: "Notas de corte",
  sourceUrl: PAGE,
  status: "found" as const,
};

const UNKNOWN = {
  edition: null,
  maxScore: null,
  quota: null,
  score: null,
  source: null,
  status: "unknown",
};

function readSeven(maxScore: number | null) {
  return toTargetCutoffFinding({ isSearched: searched, raw: { ...raw, maxScore, score: 7 } });
}

describe(toTargetCutoffFinding, () => {
  it("keeps a cut-off with its edition, list and source", () => {
    expect(toTargetCutoffFinding({ isSearched: searched, raw })).toStrictEqual({
      edition: "Sisu 2025",
      maxScore: 1000,
      quota: "ampla concorrência",
      score: 790.8,
      source: { title: "Notas de corte", url: PAGE },
      status: "found",
    });
  });

  // TJ-SP's cut-off page said "7,0" without the scale: the app shows the number only with one.
  it("keeps the scale's top only when it's a real one above the cut-off", () => {
    expect(readSeven(10)).toMatchObject({ maxScore: 10, score: 7 });
    expect(readSeven(null)).toMatchObject({ maxScore: null, score: 7 });
    expect(readSeven(Number.NaN)).toMatchObject({ maxScore: null, score: 7 });
    expect(readSeven(0)).toMatchObject({ maxScore: null, score: 7 });
  });

  it("says nothing for a score off the scale, a missing score or a page no search returned", () => {
    expect(
      toTargetCutoffFinding({ isSearched: searched, raw: { ...raw, score: 1200 } }),
    ).toStrictEqual(UNKNOWN);

    expect(
      toTargetCutoffFinding({ isSearched: searched, raw: { ...raw, score: 0 } }),
    ).toStrictEqual(UNKNOWN);

    expect(
      toTargetCutoffFinding({ isSearched: searched, raw: { ...raw, score: null } }),
    ).toStrictEqual(UNKNOWN);

    expect(toTargetCutoffFinding({ isSearched: () => false, raw })).toStrictEqual(UNKNOWN);

    expect(
      toTargetCutoffFinding({ isSearched: searched, raw: { ...raw, status: "unknown" } }),
    ).toStrictEqual(UNKNOWN);
  });
});
