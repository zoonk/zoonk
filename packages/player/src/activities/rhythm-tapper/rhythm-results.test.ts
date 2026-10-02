import { describe, expect, it } from "vitest";
import { rhythmResults, worstHit } from "./rhythm-results";

const expectedMs = [0, 500, 1000, 1500];

describe(rhythmResults, () => {
  it("takes the device's steady delay out before judging each tap", () => {
    const { extraTaps, hits } = rhythmResults({
      beatMs: 500,
      expectedMs,
      tapsMs: [150, 640, 1170, 1650],
      toleranceMs: 60,
    });

    expect(extraTaps).toBe(0);
    expect(hits.map((hit) => hit.status)).toStrictEqual(["onTime", "onTime", "onTime", "onTime"]);
  });

  it("names early, late and missed hits and counts extra taps", () => {
    const { extraTaps, hits } = rhythmResults({
      beatMs: 500,
      expectedMs,
      tapsMs: [0, 420, 1100, 1500, 1520],
      toleranceMs: 50,
    });

    expect(hits.map((hit) => hit.status)).toStrictEqual(["onTime", "early", "late", "onTime"]);
    expect(hits[1]?.offsetMs).toBe(-80);
    expect(extraTaps).toBe(1);

    const missing = rhythmResults({ beatMs: 500, expectedMs, tapsMs: [0, 500], toleranceMs: 50 });

    expect(missing.hits.map((hit) => hit.status)).toStrictEqual([
      "onTime",
      "onTime",
      "missed",
      "missed",
    ]);
  });
});

describe(worstHit, () => {
  it("points at a missed hit first, then the furthest off", () => {
    expect(
      worstHit([
        { offsetMs: -80, status: "early" },
        { offsetMs: 120, status: "late" },
      ])?.index,
    ).toBe(1);

    expect(
      worstHit([
        { offsetMs: 120, status: "late" },
        { offsetMs: null, status: "missed" },
      ])?.index,
    ).toBe(1);

    expect(worstHit([{ offsetMs: 5, status: "onTime" }])).toBeNull();
  });
});
