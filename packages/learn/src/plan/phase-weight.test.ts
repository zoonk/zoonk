import { describe, expect, it } from "vitest";
import { getPhaseWeight, getShareInPhase } from "./phase-weight";

const foundations = { endDate: "2027-01-24", hours: 90, startDate: "2026-10-12" };
const practice = { endDate: "2027-10-30", hours: 12, startDate: "2027-07-03" };
const final = { endDate: "2027-11-13", hours: 20, startDate: "2027-10-31" };

describe(getPhaseWeight, () => {
  it("weighs a dated phase by its days, first and last both counted", () => {
    expect(getPhaseWeight(foundations)).toBe(105);
  });

  it("draws a long phase with few hours longer than a short one with many", () => {
    expect(getPhaseWeight(practice)).toBeGreaterThan(getPhaseWeight(final));
  });

  it("falls back to the hours for a phase without dates", () => {
    expect(getPhaseWeight({ endDate: null, hours: 14, startDate: null })).toBe(14);
  });

  it("never weighs a phase at zero", () => {
    expect(getPhaseWeight({ endDate: null, hours: 0, startDate: null })).toBe(1);
  });
});

describe(getShareInPhase, () => {
  it("puts today's start at the phase's left edge on its first day", () => {
    expect(getShareInPhase({ at: "start", date: "2026-10-12", phase: foundations })).toBe(0);
  });

  it("puts an event that closes the phase on its last day at the right edge", () => {
    expect(getShareInPhase({ at: "end", date: "2027-01-24", phase: foundations })).toBe(1);
  });

  it("puts an event in the middle of its day", () => {
    const oneWeek = { endDate: "2026-10-18", startDate: "2026-10-12" };
    expect(getShareInPhase({ at: "middle", date: "2026-10-15", phase: oneWeek })).toBe(0.5);
  });

  it("keeps a day outside the phase on its edges", () => {
    expect(getShareInPhase({ at: "start", date: "2026-09-01", phase: foundations })).toBe(0);
    expect(getShareInPhase({ at: "end", date: "2027-03-01", phase: foundations })).toBe(1);
  });

  it("has nothing to place in a phase without dates", () => {
    expect(
      getShareInPhase({
        at: "start",
        date: "2026-10-12",
        phase: { endDate: null, startDate: null },
      }),
    ).toBeNull();
  });
});
