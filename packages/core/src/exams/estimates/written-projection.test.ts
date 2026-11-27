import { beforeEach, describe, expect, it, vi } from "vitest";
import { type WrittenSample } from "../../learner/facts/written-samples";
import { type EstimatedScore } from "../../preparation/estimated-score";
import {
  calibrationFixture,
  rowCalibrationFixture,
  weightedResiduals,
} from "../essays/_test-utils/writing-calibration";
import { type WritingCalibration } from "../essays/_utils/writing-calibration";
import { CGU as CGU_NOTICE, CGU_WRITTEN_GRADING } from "../mocks/_test-utils/cgu-written";
import { snapshotMockWriting } from "../mocks/mock-written-points";
import { projectWritten } from "./written-projection";

const calibration = vi.hoisted(() => ({ current: null as WritingCalibration | null }));

vi.mock(import("../essays/_utils/writing-calibration"), async (importOriginal) => ({
  ...(await importOriginal()),
  get writingCalibration() {
    return calibration.current;
  },
}));

const CGU = structuredClone(CGU_NOTICE);

for (const section of CGU.mock?.sections ?? []) {
  for (const task of section.tasks ?? []) {
    task.grading = {
      ...CGU_WRITTEN_GRADING,
      criteria: CGU_WRITTEN_GRADING.criteria.map((criterion) => ({
        ...criterion,
        points: task.points ?? null,
      })),
    };
  }
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
      grading: {
        ...CGU_WRITTEN_GRADING,
        criteria: CGU_WRITTEN_GRADING.criteria.map((criterion) => ({ ...criterion, points })),
      },
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
  beforeEach(() => {
    calibration.current = calibrationFixture();
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
      written: { high: 63, low: 56 },
    },
    {
      combined: { high: 122, low: 107 },
      long: { high: 35, low: 28 },
      written: { high: 54, low: 45 },
    },
    {
      combined: { high: 115, low: 103 },
      long: { high: 28, low: 24 },
      written: { high: 47, low: 41 },
    },
  ])(
    "estimates CGU points from both questions without a minimum call",
    ({ combined, long, written }) => {
      const projection = projectWritten({
        objective: OBJECTIVE,
        samples: [sample({ high: 19, key: "short", low: 17 }), sample({ key: "long", ...long })],
        structure: CGU,
      });

      expect(projection?.parts[0]?.range?.low).toBeCloseTo(written.low, 8);
      expect(projection?.parts[0]?.range?.high).toBeCloseTo(written.high, 8);
      expect(projection?.parts[0]?.standing).toBe("unmeasured");
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

    expect(result).toMatchObject({
      combined: null,
      objective: null,
      parts: [{ standing: "unmeasured" }],
    });

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

  it("reports levels for written tasks without measured row kinds", () => {
    calibration.current = null;

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

describe("a verdict from the latest mock exam beside an estimate from practice", () => {
  const GRADER = { model: "fixture/model", promptVersion: "fixture-revision" };

  const [part] =
    snapshotMockWriting({
      day: null,
      essays: [
        { itemId: "mock-short", taskKey: "short" },
        { itemId: "mock-long", taskKey: "long" },
      ],
      structure: CGU,
    }).writtenParts ?? [];

  function sat(answer: Parameters<typeof sample>[0]): WrittenSample {
    const taken = sample({ ...answer, id: `mock-${answer.key}` });
    return { ...taken, answer: { ...taken.answer, grader: GRADER }, mockExamId: "mock" };
  }

  const sitting = [
    sat({ high: 28, key: "short", low: 28 }),
    sat({ high: 62, key: "long", low: 62 }),
  ];

  function standing(samples: WrittenSample[]) {
    return projectWritten({
      mocks: part ? [{ id: "mock", part }] : [],
      objective: OBJECTIVE,
      samples,
      structure: CGU,
    })?.parts[0];
  }

  beforeEach(() => {
    calibration.current = calibrationFixture({
      rows: {
        definitePoint: rowCalibrationFixture({
          residuals: {
            over: weightedResiduals([0.02, 0.02, 0.02, 0.02]),
            under: weightedResiduals([0, 0, 0, 0]),
          },
        }),
      },
    });
  });

  it("shows the mock's verdict while the estimate agrees or straddles the minimum", () => {
    expect(standing(sitting)).toMatchObject({ range: { low: 90 }, standing: "met" });
  });

  it("keeps the practice verdict when the last mock's answers can't be judged", () => {
    const unjudged = sitting.map(({ answer, ...taken }) => ({
      ...taken,
      answer: { conditions: answer.conditions, grade: answer.grade },
      numericEligible: false,
    }));

    const practice = [
      sample({ high: 28, id: "short-practice", key: "short", low: 28 }),
      sample({ high: 62, id: "long-practice", key: "long", low: 62 }),
    ].map((taken) => ({ ...taken, answer: { ...taken.answer, grader: GRADER } }));

    expect(standing([...practice, ...unjudged])?.standing).toBe("met");
  });

  it("gives no verdict when later practice puts the whole estimate on the other side", () => {
    const later = Array.from({ length: 6 }, (_, index) => [
      sample({ high: 6, id: `short-${index}`, key: "short", low: 6 }),
      sample({ high: 12, id: `long-${index}`, key: "long", low: 12 }),
    ]).flat();

    const projected = standing([...sitting, ...later]);

    expect(projected?.range?.high).toBeLessThan(50);
    expect(projected?.standing).toBe("unmeasured");
  });
});

describe("a verdict from practice answers alone", () => {
  const GRADER = { model: "fixture/model", promptVersion: "fixture-revision" };

  function graded(answer: Parameters<typeof sample>[0]): WrittenSample {
    const taken = sample(answer);
    return { ...taken, answer: { ...taken.answer, grader: GRADER } };
  }

  function standing(short: number, long: number) {
    return projectWritten({
      objective: OBJECTIVE,
      samples: [
        graded({ high: short, key: "short", low: short }),
        graded({ high: long, key: "long", low: long }),
      ],
      structure: CGU,
    })?.parts[0]?.standing;
  }

  beforeEach(() => {
    calibration.current = calibrationFixture({
      rows: {
        definitePoint: rowCalibrationFixture({
          residuals: {
            over: weightedResiduals([0.1, 0.1, 0.1, 0.1]),
            under: weightedResiduals([0.1, 0.1, 0.1, 0.1]),
          },
        }),
      },
    });
  });

  it.each([
    { long: 62, short: 28, verdict: "met" },
    { long: 28, short: 20, verdict: "overlaps" },
    { long: 12, short: 6, verdict: "below" },
  ])(
    "calls $short + $long against the minimum of 50 as $verdict, by the grader's measured error",
    ({ long, short, verdict }) => {
      expect(standing(short, long)).toBe(verdict);
    },
  );
});
