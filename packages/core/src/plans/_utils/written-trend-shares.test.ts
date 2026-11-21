import { describe, expect, it } from "vitest";
import { getWrittenTrendShares } from "./written-trend-shares";

const APPLICATION = { id: "apply", name: "Application", points: null };
const REASONING = { id: "reason", name: "Reasoning", points: null };
const PRESENTATION = { id: "layout", name: "Apresentação e estrutura", points: null };
const LANGUAGE = { id: "mechanics", name: "Domínio da modalidade escrita formal", points: null };

describe(getWrittenTrendShares, () => {
  it("averages only content levels and reports presentation separately", () => {
    expect(
      getWrittenTrendShares({
        criteria: [APPLICATION, REASONING, PRESENTATION, LANGUAGE],
        grade: {
          criteria: [
            { id: APPLICATION.id, level: "partial" },
            { id: REASONING.id, level: "strong" },
            { id: PRESENTATION.id, level: "complete" },
            { id: LANGUAGE.id, level: "complete" },
          ],
          errorCount: 0,
          kind: "levels",
        },
        numericEligible: false,
      }),
    ).toStrictEqual({ contentShare: 0.5, presentationShare: 1 });
  });

  it("weights content levels by the criterion points in the prompt basis", () => {
    expect(
      getWrittenTrendShares({
        criteria: [{ ...APPLICATION, points: 3 }, { ...REASONING, points: 1 }, PRESENTATION],
        grade: {
          criteria: [
            { id: APPLICATION.id, level: "complete" },
            { id: REASONING.id, level: "missing" },
            { id: PRESENTATION.id, level: "partial" },
          ],
          errorCount: 0,
          kind: "levels",
        },
        numericEligible: false,
      }),
    ).toStrictEqual({ contentShare: 0.75, presentationShare: 1 / 3 });
  });

  it("returns null for content when the only criterion is presentation", () => {
    expect(
      getWrittenTrendShares({
        criteria: [PRESENTATION],
        grade: {
          criteria: [{ id: PRESENTATION.id, level: "strong" }],
          errorCount: 0,
          kind: "levels",
        },
        numericEligible: false,
      }),
    ).toStrictEqual({ contentShare: null, presentationShare: 2 / 3 });
  });

  it("reports zero content when a levels answer earns no credit", () => {
    expect(
      getWrittenTrendShares({
        criteria: [APPLICATION, PRESENTATION],
        grade: {
          criteria: [
            { id: APPLICATION.id, level: "missing" },
            { id: PRESENTATION.id, level: "missing" },
          ],
          errorCount: 0,
          kind: "levels",
        },
        numericEligible: false,
      }),
    ).toStrictEqual({ contentShare: 0, presentationShare: 0 });
  });

  it("uses the existing point range midpoints for an eligible points answer", () => {
    expect(
      getWrittenTrendShares({
        criteria: [
          { ...APPLICATION, points: 8 },
          { ...PRESENTATION, points: 2 },
        ],
        grade: {
          content: { high: 8, low: 6 },
          criteria: [
            { id: APPLICATION.id, level: "complete" },
            { id: PRESENTATION.id, level: "complete" },
          ],
          errorCount: 2,
          kind: "points",
          max: 10,
          rows: [
            { earned: 6, id: APPLICATION.id, max: 8 },
            { earned: 0, id: PRESENTATION.id, max: 2, range: { high: 2, low: 0 } },
          ],
          total: { high: 6, low: 4 },
        },
        numericEligible: true,
      }),
    ).toStrictEqual({ contentShare: 0.7, presentationShare: 0.5 });
  });
});
