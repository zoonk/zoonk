import { describe, expect, it } from "vitest";
import { getActivityCalendarIntensity } from "./activity-calendar-intensity";

describe(getActivityCalendarIntensity, () => {
  it.each([
    { activitiesCompleted: 0, expectedIntensity: 0, maximumActivitiesCompleted: 10 },
    { activitiesCompleted: 0, expectedIntensity: 0, maximumActivitiesCompleted: 0 },
    { activitiesCompleted: 1, expectedIntensity: 1, maximumActivitiesCompleted: 10 },
    { activitiesCompleted: 5, expectedIntensity: 2, maximumActivitiesCompleted: 10 },
    { activitiesCompleted: 6, expectedIntensity: 3, maximumActivitiesCompleted: 10 },
    { activitiesCompleted: 10, expectedIntensity: 4, maximumActivitiesCompleted: 10 },
  ])(
    "maps $activitiesCompleted of $maximumActivitiesCompleted activities to level $expectedIntensity",
    ({ activitiesCompleted, expectedIntensity, maximumActivitiesCompleted }) => {
      expect(
        getActivityCalendarIntensity({ activitiesCompleted, maximumActivitiesCompleted }),
      ).toBe(expectedIntensity);
    },
  );
});
