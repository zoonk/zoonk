import { describe, expect, it } from "vitest";
import { CGU } from "./_test-utils/cgu-written";
import { analyzeMock } from "./mock-analysis";
import { type MockConditions } from "./mock-contract";
import { type MockEssayView } from "./mock-view-contract";
import { snapshotMockWriting, withMockWrittenPoints } from "./mock-written-points";

const ESSAYS = [
  { itemId: "short", taskKey: "short" },
  { itemId: "long", taskKey: "long" },
];

const CONDITIONS: MockConditions = {
  day: null,
  examQuestions: null,
  fullLength: false,
  partialCredit: "allOrNothing",
  purpose: "practice",
  reused: 0,
  scoring: "raw",
  sections: [],
  shape: { area: null, day: null, kind: "written" },
  startTime: null,
  timeZone: null,
  timedOutSections: [],
  wrongPenalty: 0,
  ...snapshotMockWriting({ day: null, essays: ESSAYS, structure: CGU }),
};

const RESULT = analyzeMock({
  answers: [],
  conditions: CONDITIONS,
  minutesUsed: 0,
  preparation: null,
  previous: null,
});

function graded({
  itemId,
  high,
  low,
  max,
}: {
  itemId: string;
  high: number;
  low: number;
  max: number;
}): MockEssayView {
  return {
    area: null,
    context: null,
    grade: {
      content: { high, low },
      criteria: [],
      deduction: { high: 0, low: 0 },
      errors: [],
      ignoredFrom: null,
      kind: "points",
      max,
      nextStep: null,
      progress: null,
      rows: [],
      total: { high, low },
      zeroReason: null,
    },
    itemId,
    question: "Question",
    status: "graded",
    text: "Answer",
    unsure: false,
  };
}

describe(withMockWrittenPoints, () => {
  it("measures only this sitting and leaves missing feedback unjudged", () => {
    const short = graded({ high: 20, itemId: "short", low: 18, max: 30 });
    const elsewhere = graded({ high: 69, itemId: "another-sitting", low: 67, max: 70 });

    expect(
      withMockWrittenPoints({
        conditions: CONDITIONS,
        essays: [short, elsewhere],
        numericBlankItems: new Set(),
        result: RESULT,
      }),
    ).toMatchObject({
      points: {
        written: [
          {
            range: null,
            standing: "unmeasured",
            tasks: [{ range: { high: 20, low: 18 } }, { range: null }],
          },
        ],
      },
    });

    const long = graded({ high: 36, itemId: "long", low: 33, max: 70 });

    const result = withMockWrittenPoints({
      conditions: CONDITIONS,
      essays: [short, long],
      numericBlankItems: new Set(),
      result: RESULT,
    });

    expect(result?.points?.written?.[0]?.standing).toBe("met");
    expect(result?.points?.written?.[0]?.range?.low).toBeCloseTo(51, 8);
    expect(result?.points?.written?.[0]?.range?.high).toBeCloseTo(56, 8);
  });

  it("counts a blank answer as zero on an eligible rubric", () => {
    const short = graded({ high: 20, itemId: "short", low: 18, max: 30 });

    expect(
      withMockWrittenPoints({
        conditions: CONDITIONS,
        essays: [short],
        numericBlankItems: new Set(["long"]),
        result: RESULT,
      }),
    ).toMatchObject({
      points: {
        written: [
          {
            range: { high: 20, low: 18 },
            standing: "below",
            tasks: [{}, { range: { high: 0, low: 0 } }],
          },
        ],
      },
    });
  });
});
