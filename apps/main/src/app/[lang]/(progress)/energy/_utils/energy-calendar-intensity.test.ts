import { describe, expect, it } from "vitest";
import { getEnergyCalendarIntensity } from "./energy-calendar-intensity";

describe(getEnergyCalendarIntensity, () => {
  it.each([
    { energy: null, expectedIntensity: 0 },
    { energy: 0, expectedIntensity: 0 },
    { energy: 1, expectedIntensity: 1 },
    { energy: 25, expectedIntensity: 1 },
    { energy: 26, expectedIntensity: 2 },
    { energy: 50, expectedIntensity: 2 },
    { energy: 51, expectedIntensity: 3 },
    { energy: 75, expectedIntensity: 3 },
    { energy: 76, expectedIntensity: 4 },
    { energy: 99, expectedIntensity: 4 },
    { energy: 100, expectedIntensity: 5 },
  ])("maps $energy Energy to level $expectedIntensity", ({ energy, expectedIntensity }) => {
    expect(getEnergyCalendarIntensity(energy)).toBe(expectedIntensity);
  });
});
