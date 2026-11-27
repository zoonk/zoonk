import { describe, expect, it } from "vitest";
import {
  rowCalibrationFixture,
  weightedResiduals,
} from "../essays/_test-utils/writing-calibration";
import { readWritingPrompt } from "../essays/writing-contract";
import { CGU } from "./_test-utils/cgu-written";
import { analyzeMock } from "./mock-analysis";
import { type MockConditions } from "./mock-contract";
import { type MockEssayView } from "./mock-view-contract";
import { snapshotMockWriting, withMockWrittenPoints } from "./mock-written-points";

const CALIBRATION = [
  rowCalibrationFixture({
    residuals: {
      over: weightedResiduals(Array.from({ length: 40 }, () => 0.02)),
      under: weightedResiduals(Array.from({ length: 40 }, () => 0)),
    },
  }),
];

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
    writing: readWritingPrompt({
      charactersPerLine: 70,
      criteria: [],
      keySource: "notice",
      lines: 30,
      minimumWords: 0,
      points: max,
      taskKey: itemId,
      title: "A question",
      unit: "answer",
    }),
  };
}

describe(withMockWrittenPoints, () => {
  it("does not judge a part when it asked fewer items than the notice requires", () => {
    const structure = structuredClone(CGU);
    const short = structure.mock?.sections.find(({ kind }) => kind === "written")?.tasks?.[0];

    if (!short) {
      throw new Error("Expected a short written task");
    }

    short.count = 2;

    expect(
      withMockWrittenPoints({
        conditions: {
          ...CONDITIONS,
          ...snapshotMockWriting({ day: null, essays: ESSAYS, structure }),
        },
        essays: [
          graded({ high: 30, itemId: "short", low: 30, max: 30 }),
          graded({ high: 70, itemId: "long", low: 70, max: 70 }),
        ],
        grades: new Map(),
        numericBlankItems: new Set(),
        result: RESULT,
      }),
    ).toMatchObject({
      points: { written: [{ range: { high: 130, low: 130 }, standing: "unmeasured" }] },
    });
  });

  it("measures only this sitting and leaves missing feedback unjudged", () => {
    const short = graded({ high: 20, itemId: "short", low: 18, max: 30 });
    const elsewhere = graded({ high: 69, itemId: "another-sitting", low: 67, max: 70 });

    expect(
      withMockWrittenPoints({
        conditions: CONDITIONS,
        essays: [short, elsewhere],
        grades: new Map(),
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
      grades: new Map([
        [
          "short",
          { calibration: CALIBRATION, kind: "points", max: 30, total: { high: 20, low: 18 } },
        ],
        [
          "long",
          { calibration: CALIBRATION, kind: "points", max: 70, total: { high: 36, low: 33 } },
        ],
      ]),
      numericBlankItems: new Set(),
      result: RESULT,
    });

    expect(result?.points?.written?.[0]?.standing).toBe("overlaps");
    expect(result?.points?.written?.[0]?.range?.low).toBeCloseTo(51, 8);
    expect(result?.points?.written?.[0]?.range?.high).toBeCloseTo(56, 8);
  });

  it("keeps a written part's minimum with the part, graded or not", () => {
    const [part] = CONDITIONS.writtenParts ?? [];
    const minimum = { unit: "points" as const, value: 50 };

    const result = withMockWrittenPoints({
      conditions: CONDITIONS,
      essays: [],
      grades: new Map(),
      numericBlankItems: new Set(),
      result: RESULT && {
        ...RESULT,
        points: {
          asked: 0,
          earned: 0,
          max: null,
          met: null,
          minimum: null,
          parts: [],
          projected: null,
          short: null,
          unjudged: [
            { minimum, name: part?.name ?? null },
            { minimum, name: "Objective test" },
          ],
        },
      },
    });

    expect(result?.points?.written).toMatchObject([{ name: part?.name, range: null }]);
    expect(result?.points?.unjudged).toStrictEqual([{ minimum, name: "Objective test" }]);
  });

  it("shows a blank as zero and leaves a part without a grade unmeasured", () => {
    const short = graded({ high: 20, itemId: "short", low: 18, max: 30 });

    expect(
      withMockWrittenPoints({
        conditions: CONDITIONS,
        essays: [short],
        grades: new Map(),
        numericBlankItems: new Set(["long"]),
        result: RESULT,
      }),
    ).toMatchObject({
      points: {
        written: [
          {
            range: { high: 20, low: 18 },
            standing: "unmeasured",
            tasks: [{}, { range: { high: 0, low: 0 } }],
          },
        ],
      },
    });
  });
});
