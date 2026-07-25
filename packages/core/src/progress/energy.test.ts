import { describe, expect, it } from "vitest";
import { clampEnergy, projectCurrentEnergy, projectPersistedEnergy } from "./energy";

describe(clampEnergy, () => {
  it("clamps below minimum to 0", () => {
    expect(clampEnergy(-5)).toBe(0);
  });

  it("clamps above maximum to 100", () => {
    expect(clampEnergy(150)).toBe(100);
  });

  it("returns value unchanged when within bounds", () => {
    expect(clampEnergy(50)).toBe(50);
  });

  it("returns 0 at exact minimum", () => {
    expect(clampEnergy(0)).toBe(0);
  });

  it("returns 100 at exact maximum", () => {
    expect(clampEnergy(100)).toBe(100);
  });
});

describe(projectCurrentEnergy, () => {
  it("decays only fully inactive calendar days", () => {
    expect(
      projectCurrentEnergy({
        cursor: { date: new Date("2026-01-07T00:00:00Z"), energyAtEnd: 50 },
        targetDate: new Date("2026-01-10T00:00:00Z"),
      }),
    ).toStrictEqual({ currentEnergy: 48, effectiveDate: new Date("2026-01-10T00:00:00Z") });
  });

  it("keeps a future durable cursor authoritative after westward travel", () => {
    expect(
      projectCurrentEnergy({
        cursor: { date: new Date("2026-01-12T00:00:00Z"), energyAtEnd: 70 },
        targetDate: new Date("2026-01-11T00:00:00Z"),
      }),
    ).toStrictEqual({ currentEnergy: 70, effectiveDate: new Date("2026-01-12T00:00:00Z") });
  });

  it("starts a learner without an Energy cursor at zero on the target date", () => {
    expect(
      projectCurrentEnergy({ cursor: null, targetDate: new Date("2026-01-10T00:00:00Z") }),
    ).toStrictEqual({ currentEnergy: 0, effectiveDate: new Date("2026-01-10T00:00:00Z") });
  });
});

describe(projectPersistedEnergy, () => {
  it("interprets the last completion instant in the caller's current timezone", () => {
    const persistedEnergy = { currentEnergy: 70, lastActiveAt: new Date("2026-07-12T14:00:00Z") };

    expect(
      projectPersistedEnergy({
        persistedEnergy,
        targetDate: new Date("2026-07-12T00:00:00Z"),
        timeZone: "Pacific/Honolulu",
      }),
    ).toStrictEqual({ currentEnergy: 70, effectiveDate: new Date("2026-07-12T00:00:00Z") });

    expect(
      projectPersistedEnergy({
        persistedEnergy,
        targetDate: new Date("2026-07-13T00:00:00Z"),
        timeZone: "Pacific/Kiritimati",
      }),
    ).toStrictEqual({ currentEnergy: 70, effectiveDate: new Date("2026-07-13T00:00:00Z") });
  });
});
