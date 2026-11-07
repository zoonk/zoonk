import { describe, expect, it } from "vitest";
import { pickCurrentRelease } from "./current-release";

const NOW = new Date("2026-11-06T12:00:00.000Z");

function release(id: string, releasedAt: string | null, releasedMonthOnly = false) {
  return {
    id,
    releasedAt: releasedAt ? new Date(`${releasedAt}T00:00:00.000Z`) : null,
    releasedMonthOnly,
  };
}

describe(pickCurrentRelease, () => {
  it("picks the newest release already out", () => {
    const releases = [
      release("a", "2025-10-21"),
      release("b", "2026-10-22"),
      release("c", "2024-10-21"),
    ];

    expect(pickCurrentRelease({ now: NOW, releases })?.id).toBe("b");
  });

  it("counts a release out on its day", () => {
    const releases = [release("a", "2025-10-21"), release("b", "2026-11-06")];
    expect(pickCurrentRelease({ now: NOW, releases })?.id).toBe("b");
  });

  it("never makes an announced release or one with no known date current", () => {
    const releases = [release("a", "2025-10-21"), release("b", "2026-12-15"), release("c", null)];
    expect(pickCurrentRelease({ now: NOW, releases })?.id).toBe("a");
  });

  it("has no current release when none has come out", () => {
    expect(pickCurrentRelease({ now: NOW, releases: [release("a", "2027-01-01")] })).toBeNull();
    expect(pickCurrentRelease({ now: NOW, releases: [] })).toBeNull();
  });

  it("counts a release dated by its month as out once that month ends", () => {
    const releases = [release("a", "2026-10-21"), release("b", "2026-11-01", true)];

    expect(pickCurrentRelease({ now: NOW, releases })?.id).toBe("a");

    expect(pickCurrentRelease({ now: new Date("2026-12-01T00:00:00.000Z"), releases })?.id).toBe(
      "b",
    );
  });

  it("orders a release dated by its month after the days of that month", () => {
    const releases = [release("a", "2026-09-21"), release("b", "2026-09-01", true)];
    expect(pickCurrentRelease({ now: NOW, releases })?.id).toBe("b");
  });

  it("settles releases out the same day the same way every time", () => {
    const releases = [release("018f-a", "2026-09-19"), release("018f-b", "2026-09-19")];

    expect(pickCurrentRelease({ now: NOW, releases })?.id).toBe("018f-b");
    expect(pickCurrentRelease({ now: NOW, releases: releases.toReversed() })?.id).toBe("018f-b");
  });
});
