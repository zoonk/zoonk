import { describe, expect, it } from "vitest";
import { getActivityCalendarIntensity } from "./activity-calendar-intensity";

describe(getActivityCalendarIntensity, () => {
  it.each([
    { expectedIntensity: 0, maximumTimeSpentSeconds: 600, studied: false, timeSpentSeconds: 0 },
    { expectedIntensity: 0, maximumTimeSpentSeconds: 600, studied: false, timeSpentSeconds: 120 },
    { expectedIntensity: 1, maximumTimeSpentSeconds: 600, studied: true, timeSpentSeconds: 0 },
    { expectedIntensity: 1, maximumTimeSpentSeconds: 0, studied: true, timeSpentSeconds: 0 },
    { expectedIntensity: 1, maximumTimeSpentSeconds: 600, studied: true, timeSpentSeconds: 60 },
    { expectedIntensity: 2, maximumTimeSpentSeconds: 600, studied: true, timeSpentSeconds: 300 },
    { expectedIntensity: 3, maximumTimeSpentSeconds: 600, studied: true, timeSpentSeconds: 360 },
    { expectedIntensity: 4, maximumTimeSpentSeconds: 600, studied: true, timeSpentSeconds: 600 },
  ])(
    "shades a day studied=$studied with $timeSpentSeconds of $maximumTimeSpentSeconds seconds at level $expectedIntensity",
    ({ expectedIntensity, maximumTimeSpentSeconds, studied, timeSpentSeconds }) => {
      expect(
        getActivityCalendarIntensity({ maximumTimeSpentSeconds, studied, timeSpentSeconds }),
      ).toBe(expectedIntensity);
    },
  );
});
