import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { describe, expect, it } from "vitest";
import { scoreEnemWriting } from "./enem-writing";

const complete: WritingEvidence = {
  aspects: [],
  criteria: ["c1", "c2", "c3", "c4", "c5"].map((id) => ({
    comment: "",
    example: null,
    id,
    level: "complete",
    quote: null,
  })),
  errors: [],
  interventionElements: { action: true, agent: true, detail: true, effect: true, means: true },
  nextStep: null,
  onTopicQuote: null,
  zeroKind: null,
  zeroQuote: null,
  zeroRuleIndex: null,
};

describe(scoreEnemWriting, () => {
  it("bounds the total discrepancy when the first examiner awards 1000", () => {
    const score = scoreEnemWriting(complete, false);

    expect(score?.content).toStrictEqual({ high: 1000, low: 960 });
    expect(score?.rows).toHaveLength(5);

    expect(score?.rows.map(({ range }) => range)).toStrictEqual(
      Array.from({ length: 5 }, () => ({ high: 200, low: 160 })),
    );
  });

  it("caps the second examiner's marks before averaging", () => {
    const score = scoreEnemWriting(
      {
        ...complete,
        criteria: complete.criteria.map((criterion) =>
          criterion.id === "c1" ? { ...criterion, level: "strong" } : criterion,
        ),
      },
      false,
    );

    expect(score?.content).toStrictEqual({ high: 980, low: 920 });
    expect(score?.rows[0]?.range).toStrictEqual({ high: 180, low: 120 });
  });

  it("averages a proposal awarded 160 with a second mark up to 200", () => {
    const score = scoreEnemWriting(
      {
        ...complete,
        interventionElements: {
          action: true,
          agent: true,
          detail: false,
          effect: true,
          means: true,
        },
      },
      false,
    );

    expect(score?.content).toStrictEqual({ high: 980, low: 920 });
    expect(score?.rows[4]?.range).toStrictEqual({ high: 180, low: 120 });
  });

  it("applies the discrepancy limit in both directions and keeps proposal caps", () => {
    const score = scoreEnemWriting(
      {
        ...complete,
        criteria: complete.criteria.map((criterion) =>
          criterion.id === "c1" ? { ...criterion, level: "strong" } : criterion,
        ),
        proposalLimit: "conditional",
      },
      false,
    );

    expect(score?.content).toStrictEqual({ high: 860, low: 800 });
    expect(score?.rows[0]?.range).toStrictEqual({ high: 180, low: 120 });
    expect(score?.rows[4]?.range).toStrictEqual({ high: 80, low: 60 });
  });

  it("keeps a missing or invalid proposal at zero", () => {
    const missing = scoreEnemWriting({ ...complete, interventionElements: null }, false);
    const invalid = scoreEnemWriting({ ...complete, proposalLimit: "invalid" }, false);

    expect(missing?.rows[4]?.range).toStrictEqual({ high: 0, low: 0 });
    expect(invalid).toStrictEqual(missing);
  });

  it("returns exact zero when an essay is invalidated, even without criterion evidence", () => {
    const score = scoreEnemWriting(
      { ...complete, criteria: [], interventionElements: undefined },
      true,
    );

    expect(score?.content).toStrictEqual({ high: 0, low: 0 });

    expect(score?.rows.map(({ range }) => range)).toStrictEqual(
      Array.from({ length: 5 }, () => ({ high: 0, low: 0 })),
    );
  });
});
