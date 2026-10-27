import { describe, expect, it } from "vitest";
import {
  type PlanSummary,
  readFreshPlanSummary,
  readPlanSummary,
  reduceCompletedSummary,
  reduceRestoredSummary,
} from "./plan-summary";
import { type SelectedCoverage } from "./selected-summary-contract";

const plan = { id: "plan-a", userId: "learner-a", version: 7 };

/** Two skills; `shared` teaches both, `straddling` runs past the deadline, `after` is past it. */
const coverage: SelectedCoverage = {
  basis: "selected",
  coreFits: true,
  coveredShare: 0.5,
  deadline: "2026-11-01",
  fits: false,
  measure: "goal",
  shortLessons: [
    { countedRaw: 0, lessonId: "after", requiredRaw: 10, skillIds: ["s2"] },
    { countedRaw: 4, lessonId: "shared", requiredRaw: 10, skillIds: ["s1", "s2"] },
  ],
  skills: [
    { coveredRaw: 14, requiredRaw: 20, skillId: "s1", state: "measured", worth: 1 },
    { coveredRaw: 4, requiredRaw: 20, skillId: "s2", state: "measured", worth: 1 },
  ],
  targetDate: "2026-11-01",
};

const summary: PlanSummary = {
  basis: {
    layoutInputVersion: 4,
    layoutStudyDay: "2026-10-14",
    planId: plan.id,
    planVersion: plan.version,
    timeZone: "America/Sao_Paulo",
    userId: plan.userId,
  },
  schemaVersion: 2,
  selected: {
    bases: null,
    coverage,
    endDate: "2026-11-03",
    forecast: {
      basis: "estimated",
      dailyNeed: { basis: "estimated", minutes: 25 },
      finish: { date: "2026-11-03" },
    },
    phaseDates: { structureKey: null, trigger: false },
    requirement: { doneRaw: 0, remainingRaw: 40, totalRaw: 40 },
    sourceSkillIds: ["s1", "s2"],
    totalMinutes: 60,
  },
};

describe(readPlanSummary, () => {
  it("describes the plan version it was posted with, whatever happened since", () => {
    expect(readPlanSummary({ plan, value: summary })).toStrictEqual(summary);
  });

  it.each([{ id: "plan-b" }, { userId: "learner-b" }, { version: 8 }])(
    "describes no other plan, owner or version (%j)",
    (change) => {
      expect(readPlanSummary({ plan: { ...plan, ...change }, value: summary })).toBeNull();
    },
  );

  it.each([
    null,
    {},
    { ...summary, schemaVersion: 1 },
    {
      basis: {
        inputVersion: 4,
        planId: plan.id,
        planVersion: plan.version,
        studyDay: "2026-10-14",
        timeZone: "UTC",
        userId: plan.userId,
      },
      schemaVersion: 1,
      selected: summary.selected,
    },
  ])("reads a legacy or unknown value as pending, never as a plan with no work (%#)", (value) => {
    expect(readPlanSummary({ plan, value })).toBeNull();
  });
});

describe(readFreshPlanSummary, () => {
  it("checks the session's input version and study day against a layout summary", () => {
    const basis = {
      inputVersion: 4,
      planId: plan.id,
      planVersion: plan.version,
      studyDay: "2026-10-14",
      timeZone: "America/Sao_Paulo",
      userId: plan.userId,
    };

    expect(readFreshPlanSummary({ basis, value: summary })?.selected).toStrictEqual(
      summary.selected,
    );

    expect(
      readFreshPlanSummary({ basis: { ...basis, inputVersion: 5 }, value: summary }),
    ).toBeNull();

    expect(
      readFreshPlanSummary({ basis: { ...basis, studyDay: "2026-10-15" }, value: summary }),
    ).toBeNull();

    // Session metadata writes keep the same selected facts with the updated input basis.
    const restamped = { basis, schemaVersion: 1, selected: summary.selected };

    expect(readFreshPlanSummary({ basis, value: restamped })?.selected).toStrictEqual(
      summary.selected,
    );

    expect(readPlanSummary({ plan, value: restamped })).toBeNull();
  });
});

describe(reduceCompletedSummary, () => {
  it("counts a lesson that ran past the deadline whole once it's done", () => {
    const reduction = reduceCompletedSummary({ completed: [{ lessonId: "shared" }], summary });

    expect(reduction).toMatchObject({ coveredShare: 0.75, kind: "reduced" });

    const reduced = reduction.kind === "reduced" ? reduction.summary : null;

    expect(reduced?.selected.coverage?.skills.map((skill) => skill.coveredRaw)).toStrictEqual([
      20, 10,
    ]);

    expect(reduced?.selected.coverage?.shortLessons.map((lesson) => lesson.lessonId)).toStrictEqual(
      ["after"],
    );

    // The basis stays: a completion doesn't make another plan version.
    expect(reduced?.basis).toStrictEqual(summary.basis);
    expect(reduced?.selected.requirement).toStrictEqual(summary.selected.requirement);
  });

  it("counts a shared lesson once however often it's reported", () => {
    const once = reduceCompletedSummary({ completed: [{ lessonId: "shared" }], summary });

    const twice = reduceCompletedSummary({
      completed: [{ lessonId: "shared" }, { lessonId: "shared" }],
      summary,
    });

    expect(twice).toStrictEqual(once);

    const again =
      once.kind === "reduced"
        ? reduceCompletedSummary({ completed: [{ lessonId: "shared" }], summary: once.summary })
        : null;

    expect(again).toStrictEqual({ kind: "unchanged" });
  });

  it("fits once the last lesson it was short of is done", () => {
    const reduction = reduceCompletedSummary({
      completed: [{ lessonId: "shared" }, { lessonId: "after" }],
      summary,
    });

    expect(reduction).toMatchObject({ coveredShare: 1, kind: "reduced" });
    expect(reduction.kind === "reduced" && reduction.summary.selected.coverage?.fits).toBe(true);
  });

  it("keeps a plan short of a topic from fitting, whatever is done", () => {
    const missingTopic = {
      ...summary,
      selected: { ...summary.selected, coverage: { ...coverage, coreFits: false } },
    };

    const reduction = reduceCompletedSummary({
      completed: [{ lessonId: "shared" }, { lessonId: "after" }],
      summary: missingTopic,
    });

    expect(reduction.kind === "reduced" && reduction.summary.selected.coverage?.fits).toBe(false);
  });

  it("leaves the summary as it is for work it already counted whole", () => {
    expect(
      reduceCompletedSummary({ completed: [{ lessonId: "on-time" }, { lessonId: null }], summary }),
    ).toStrictEqual({ kind: "unchanged" });
  });

  it("reads a plan without a summary that describes it as pending", () => {
    expect(
      reduceCompletedSummary({ completed: [{ lessonId: "shared" }], summary: null }),
    ).toStrictEqual({ kind: "pending" });
  });
});

describe(reduceRestoredSummary, () => {
  it("restores the snapshot's summary for the restored version, with later progress counted", () => {
    const restored = reduceRestoredSummary({
      completed: [{ lessonId: "after" }, { lessonId: "on-time" }],
      planVersion: 9,
      summary,
    });

    expect(restored?.basis).toStrictEqual({ ...summary.basis, planVersion: 9 });
    expect(restored?.selected.coverage?.skills[1]?.coveredRaw).toBe(14);

    expect(readPlanSummary({ plan: { ...plan, version: 9 }, value: restored })).toStrictEqual(
      restored,
    );
  });

  it("restores a snapshot without one as pending", () => {
    expect(reduceRestoredSummary({ completed: [], planVersion: 9, summary: null })).toBeNull();
  });
});
