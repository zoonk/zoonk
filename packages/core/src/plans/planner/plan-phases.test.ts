import { describe, expect, it } from "vitest";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { getExamWindows, getLearningShare } from "./plan-phases";

function windowsFor({ start, target }: { start: string; target: string }) {
  return getExamWindows({ planStart: fromIsoDate(start), targetDate: fromIsoDate(target) }).map(
    (window) => ({
      endDate: toIsoDate(window.endDate),
      kind: window.kind,
      startDate: toIsoDate(window.startDate),
    }),
  );
}

describe(getExamWindows, () => {
  it("splits 46 days before an exam into four phases, ending the day before it", () => {
    expect(windowsFor({ start: "2026-09-23", target: "2026-11-08" })).toStrictEqual([
      { endDate: "2026-10-04", kind: "foundations", startDate: "2026-09-23" },
      { endDate: "2026-10-20", kind: "gaps", startDate: "2026-10-05" },
      { endDate: "2026-10-31", kind: "practice", startDate: "2026-10-21" },
      { endDate: "2026-11-07", kind: "finalStretch", startDate: "2026-11-01" },
    ]);
  });

  it("caps the final stretch at two weeks", () => {
    const windows = windowsFor({ start: "2026-01-01", target: "2027-01-01" });

    expect(windows.at(-1)).toStrictEqual({
      endDate: "2026-12-31",
      kind: "finalStretch",
      startDate: "2026-12-18",
    });
  });

  it("plans a test that's days away day by day: gaps, practice and the day before", () => {
    expect(windowsFor({ start: "2026-09-28", target: "2026-10-01" })).toStrictEqual([
      { endDate: "2026-09-28", kind: "gaps", startDate: "2026-09-28" },
      { endDate: "2026-09-29", kind: "practice", startDate: "2026-09-29" },
      { endDate: "2026-09-30", kind: "finalStretch", startDate: "2026-09-30" },
    ]);
  });

  it("has no phases once the exam day has come", () => {
    expect(windowsFor({ start: "2026-10-01", target: "2026-10-01" })).toStrictEqual([]);
  });
});

describe(getLearningShare, () => {
  it("shrinks new learning as the exam nears and follows the learner's steering", () => {
    const shares = (["foundations", "gaps", "practice", "finalStretch"] as const).map((phaseKind) =>
      getLearningShare({ phaseKind, practiceBias: "balanced" }),
    );

    expect(shares).toStrictEqual([0.6, 0.5, 0.35, 0]);
    expect(getLearningShare({ phaseKind: "learn", practiceBias: "morePractice" })).toBe(0.4);
    expect(getLearningShare({ phaseKind: "learn", practiceBias: "moreExplanation" })).toBe(0.6);
  });
});
