import { describe, expect, it } from "vitest";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import {
  type ExamWindow,
  getExamWindows,
  getKeptExamWindows,
  getLearningShare,
} from "./plan-phases";

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

function toIsoWindows(windows: readonly ExamWindow[]) {
  return windows.map((window) => ({
    endDate: toIsoDate(window.endDate),
    kind: window.kind,
    startDate: toIsoDate(window.startDate),
  }));
}

describe(getKeptExamWindows, () => {
  const planStart = fromIsoDate("2026-09-26");
  const shown = getExamWindows({ planStart, targetDate: fromIsoDate("2027-11-14") });

  /*
   * Walk: Ana moved ENEM from 400 days away to 36, two weeks into her foundations. Laid out from
   * the plan's start, the foundations ended two days earlier with 4 of its lessons done, and
   * Journey showed it finished.
   */
  it("keeps the phase the learner is in open when a new date would end it before today", () => {
    const windows = getKeptExamWindows({
      planStart,
      shown,
      targetDate: fromIsoDate("2026-11-15"),
      today: fromIsoDate("2026-10-10"),
    });

    expect(toIsoWindows(windows)).toStrictEqual([
      { endDate: "2026-10-18", kind: "foundations", startDate: "2026-09-26" },
      { endDate: "2026-10-30", kind: "gaps", startDate: "2026-10-19" },
      { endDate: "2026-11-09", kind: "practice", startDate: "2026-10-31" },
      { endDate: "2026-11-14", kind: "finalStretch", startDate: "2026-11-10" },
    ]);

    // The next day, those are the dates for this exam day: nothing moves.
    expect(
      getKeptExamWindows({
        planStart,
        shown: windows,
        targetDate: fromIsoDate("2026-11-15"),
        today: fromIsoDate("2026-10-11"),
      }),
    ).toStrictEqual(windows);
  });

  it("keeps the phases already behind and lays out the one the learner is in from where it began", () => {
    const behind = getExamWindows({ planStart, targetDate: fromIsoDate("2026-12-31") });
    const gaps = behind.find((window) => window.kind === "gaps");

    const windows = getKeptExamWindows({
      planStart,
      shown: behind,
      targetDate: fromIsoDate("2026-11-30"),
      today: fromIsoDate("2026-11-10"),
    });

    expect(windows[0]).toStrictEqual(behind[0]);
    expect(windows[1]?.startDate).toStrictEqual(gaps?.startDate);
    expect(windows.at(-1)?.endDate).toStrictEqual(fromIsoDate("2026-11-29"));
  });

  it("lays the phases out from the plan's start when the new date leaves the learner's phase open", () => {
    const targetDate = fromIsoDate("2027-05-01");

    expect(
      getKeptExamWindows({ planStart, shown, targetDate, today: fromIsoDate("2026-10-10") }),
    ).toStrictEqual(getExamWindows({ planStart, targetDate }));
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
