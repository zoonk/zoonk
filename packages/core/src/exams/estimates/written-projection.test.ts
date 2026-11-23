import { beforeEach, describe, expect, it, vi } from "vitest";
import { type WrittenSample } from "../../learner/facts/written-samples";
import { type EstimatedScore } from "../../preparation/estimated-score";
import { passedWritingEvaluations } from "../essays/_utils/writing-rubric-evaluations";
import { getWritingRubricFingerprint } from "../essays/_utils/writing-task-basis";
import { CGU, CGU_WRITTEN_GRADING } from "../mocks/_test-utils/cgu-written";
import { projectWritten } from "./written-projection";

vi.mock("../essays/_utils/writing-rubric-evaluations", () => ({ passedWritingEvaluations: {} }));

function allowWritingPoints(points: number) {
  const basis = { grading: CGU_WRITTEN_GRADING, points };

  Object.assign(passedWritingEvaluations, {
    [getWritingRubricFingerprint(basis)]: {
      arithmetic: { rounding: null, zeroRules: [] },
      corpus: "fixture",
      kind: "points",
      model: "fixture/model",
      promptRevision: "fixture-revision",
    },
  });
}

const OBJECTIVE: EstimatedScore = {
  calibrated: false,
  high: 68,
  low: 62,
  mocks: 1,
  scale: "percent",
};

function sample({
  key,
  low,
  high,
  id = key,
  version = "firstDraft",
  numericEligible = true,
}: {
  key: "short" | "long";
  low: number;
  high: number;
  id?: string;
  version?: "firstDraft" | "rewrite";
  numericEligible?: boolean;
}): WrittenSample {
  const lines = key === "short" ? 30 : 60;
  const points = key === "short" ? 30 : 70;

  return {
    answer: {
      conditions: {
        admissionId: "admission",
        estimatedLines: lines,
        origin: "block",
        timed: false,
        version,
      },
      grade: {
        content: { high, low },
        criteria: [],
        errorCount: 0,
        kind: "points",
        max: points,
        rows: [],
        total: { high, low },
      },
    },
    answeredAt: new Date("2026-11-20"),
    durationMs: 0,
    id,
    itemId: id,
    localDate: new Date("2026-11-20"),
    mockExamId: null,
    numericEligible,
    prompt: {
      assessedSkillIds: ["skill"],
      criteria: [],
      grading: CGU_WRITTEN_GRADING,
      lines,
      part: "Written test",
      points,
      taskKey: key,
      title: "Topic",
      unit: "answer",
    },
    studySessionId: "session",
  };
}

describe(projectWritten, () => {
  const evaluatedPoints = [30, 70];

  beforeEach(() => {
    evaluatedPoints.forEach((points) => allowWritingPoints(points));
  });

  it("retains the objective and measured question while naming the missing written task", () => {
    expect(
      projectWritten({
        objective: OBJECTIVE,
        samples: [sample({ high: 19, key: "short", low: 17 })],
        structure: CGU,
      }),
    ).toMatchObject({
      combined: null,
      max: 200,
      objective: { high: 68, low: 62 },
      objectiveMax: 100,
      parts: [
        {
          decimals: 0,
          max: 100,
          range: null,
          scale: "points",
          standing: "unmeasured",
          tasks: [
            { key: "short", max: 30, range: { high: 19, low: 17 } },
            { key: "long", max: 70, range: null },
          ],
        },
      ],
    });
  });

  it.each([
    {
      combined: { high: 131, low: 118 },
      long: { high: 44, low: 39 },
      standing: "met",
      written: { high: 63, low: 56 },
    },
    {
      combined: { high: 122, low: 107 },
      long: { high: 35, low: 28 },
      standing: "overlaps",
      written: { high: 54, low: 45 },
    },
    {
      combined: { high: 115, low: 103 },
      long: { high: 28, low: 24 },
      standing: "below",
      written: { high: 47, low: 41 },
    },
  ])(
    "judges CGU on both questions together ($standing)",
    ({ combined, long, standing, written }) => {
      const projection = projectWritten({
        objective: OBJECTIVE,
        samples: [sample({ high: 19, key: "short", low: 17 }), sample({ key: "long", ...long })],
        structure: CGU,
      });

      expect(projection?.parts[0]?.range?.low).toBeCloseTo(written.low, 8);
      expect(projection?.parts[0]?.range?.high).toBeCloseTo(written.high, 8);
      expect(projection?.parts[0]?.standing).toBe(standing);
      expect(projection?.combined?.low).toBeCloseTo(combined.low, 8);
      expect(projection?.combined?.high).toBeCloseTo(combined.high, 8);
    },
  );

  it("uses only recent independent fresh responses and keeps writing visible without objective evidence", () => {
    const samples = [
      sample({ high: 30, key: "short", low: 30, version: "rewrite" }),
      sample({ high: 13, id: "first", key: "short", low: 10 }),
      sample({ high: 30, id: "first", key: "short", low: 30 }),
      sample({ high: 16, id: "second", key: "short", low: 13 }),
      sample({ high: 19, id: "third", key: "short", low: 16 }),
      sample({ high: 30, id: "fourth", key: "short", low: 30 }),
      sample({ high: 54, key: "long", low: 40 }),
    ];

    const result = projectWritten({ objective: null, samples, structure: CGU });
    expect(result).toMatchObject({ combined: null, objective: null, parts: [{ standing: "met" }] });
    expect(result?.parts[0]?.range?.low).toBeCloseTo(53, 8);
    expect(result?.parts[0]?.range?.high).toBeCloseTo(70, 8);
  });

  it("names a corrected task as unmeasured when only its earlier criteria have scores", () => {
    const structure = structuredClone(CGU);
    const written = structure.mock?.sections.find(({ kind }) => kind === "written");
    const task = written?.tasks?.find(({ key }) => key === "long");
    const grading = task?.grading;

    if (!task || !grading) {
      throw new Error("Expected the long CGU task criterion");
    }

    task.grading = {
      ...grading,
      criteria: grading.criteria.map((criterion) => ({ ...criterion, points: 2 })),
    };

    const samples = [
      sample({ high: 19, key: "short", low: 17 }),
      sample({ high: 50, key: "long", low: 45 }),
    ];

    expect(projectWritten({ objective: OBJECTIVE, samples, structure })).toMatchObject({
      combined: null,
      parts: [
        {
          range: null,
          standing: "unmeasured",
          tasks: [
            { key: "short", range: { high: 19, low: 17 } },
            { key: "long", range: null },
          ],
        },
      ],
    });
  });

  it("reports levels for written tasks without a passed evaluation", () => {
    for (const points of evaluatedPoints) {
      Reflect.deleteProperty(
        passedWritingEvaluations,
        getWritingRubricFingerprint({ grading: CGU_WRITTEN_GRADING, points }),
      );
    }

    const samples = [
      sample({ high: 20, key: "short", low: 15 }),
      sample({ high: 50, key: "long", low: 45 }),
    ];

    expect(projectWritten({ objective: OBJECTIVE, samples, structure: CGU })).toMatchObject({
      combined: null,
      parts: [
        {
          decimals: 0,
          range: null,
          scale: "levels",
          standing: "unmeasured",
          tasks: [{ range: null }, { range: null }],
        },
      ],
    });
  });
});
