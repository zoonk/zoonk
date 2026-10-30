import { describe, expect, it } from "vitest";
import { toCourseWeightsFinding } from "./course-weights-finding";

const PAGE = "https://www.ufmg.br/sisu/pesos";
const searched = (url: string) => url.startsWith("https://www.ufmg.br/");

const raw = {
  edition: " SISU 2026 ",
  sourceTitle: "Pesos por curso",
  sourceUrl: PAGE,
  status: "found" as const,
  weights: [
    { subject: 2, weight: 1 },
    { subject: 1, weight: 1 },
    { subject: 3, weight: 2 },
  ],
};

const UNKNOWN = { edition: null, source: null, status: "unknown", weights: [] };

describe(toCourseWeightsFinding, () => {
  it("keeps one weight per part, in the parts' order, with its source", () => {
    expect(toCourseWeightsFinding({ isSearched: searched, raw, subjectCount: 3 })).toStrictEqual({
      edition: "SISU 2026",
      source: { title: "Pesos por curso", url: PAGE },
      status: "found",
      weights: [1, 1, 2],
    });
  });

  it("drops weights that miss a part, repeat one, look like scores or come from nowhere", () => {
    expect(toCourseWeightsFinding({ isSearched: searched, raw, subjectCount: 4 })).toStrictEqual(
      UNKNOWN,
    );

    const repeated = { ...raw, weights: [...raw.weights, { subject: 3, weight: 3 }] };

    expect(
      toCourseWeightsFinding({ isSearched: searched, raw: repeated, subjectCount: 3 }),
    ).toStrictEqual(UNKNOWN);

    const score = { ...raw, weights: [...raw.weights.slice(0, 2), { subject: 3, weight: 700 }] };

    expect(
      toCourseWeightsFinding({ isSearched: searched, raw: score, subjectCount: 3 }),
    ).toStrictEqual(UNKNOWN);

    expect(toCourseWeightsFinding({ isSearched: () => false, raw, subjectCount: 3 })).toStrictEqual(
      UNKNOWN,
    );

    expect(
      toCourseWeightsFinding({
        isSearched: searched,
        raw: { ...raw, status: "unknown" },
        subjectCount: 3,
      }),
    ).toStrictEqual(UNKNOWN);
  });
});
