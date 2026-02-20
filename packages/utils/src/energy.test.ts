import { describe, expect, test } from "vitest";
import { computeDecayedEnergy, getDateOnly } from "./energy";

describe(getDateOnly, () => {
  test("strips time and creates UTC midnight", () => {
    const date = new Date("2025-03-15T14:30:45.123Z");
    const result = getDateOnly(date);

    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(2);
    expect(result.getUTCDate()).toBe(15);
  });
});

describe(computeDecayedEnergy, () => {
  test("same day: no decay", () => {
    const lastActiveAt = new Date("2025-01-10T10:00:00Z");
    const now = new Date("2025-01-10T23:00:00Z");

    expect(computeDecayedEnergy(50, lastActiveAt, now)).toBe(50);
  });

  test("1 day gap: 0 inactive days, no decay", () => {
    const lastActiveAt = new Date("2025-01-10T10:00:00Z");
    const now = new Date("2025-01-11T10:00:00Z");

    expect(computeDecayedEnergy(50, lastActiveAt, now)).toBe(50);
  });

  test("3 day gap: 2 inactive days, decay=2", () => {
    const lastActiveAt = new Date("2025-01-10T10:00:00Z");
    const now = new Date("2025-01-13T10:00:00Z");

    expect(computeDecayedEnergy(50, lastActiveAt, now)).toBe(48);
  });

  test("5 day gap: 4 inactive days, decay=4", () => {
    const lastActiveAt = new Date("2025-01-10T10:00:00Z");
    const now = new Date("2025-01-15T10:00:00Z");

    expect(computeDecayedEnergy(50, lastActiveAt, now)).toBe(46);
  });

  test("energy clamped at 0", () => {
    const lastActiveAt = new Date("2025-01-10T10:00:00Z");
    const now = new Date("2025-01-20T10:00:00Z");

    expect(computeDecayedEnergy(2, lastActiveAt, now)).toBe(0);
  });

  test("cross-day boundary: lastActive=Jan 10 11pm, now=Jan 12 1am → 1 inactive day, decay=1", () => {
    const lastActiveAt = new Date("2025-01-10T23:00:00Z");
    const now = new Date("2025-01-12T01:00:00Z");

    expect(computeDecayedEnergy(50, lastActiveAt, now)).toBe(49);
  });
});
