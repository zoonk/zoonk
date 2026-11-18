import { describe, expect, it } from "vitest";
import { currentUserActivityResponseSchema } from "./openapi/schemas/current-user-progress";
import { serializeLearningActivity } from "./progress-serializers";

describe(serializeLearningActivity, () => {
  it("sends each calendar day's study time, which the apps shade the calendar by", () => {
    const activity = serializeLearningActivity({
      days: [
        {
          activitiesCompleted: 3,
          date: new Date("2025-01-05T00:00:00Z"),
          lessonCompletions: 1,
          timeSpentSeconds: 120,
        },
      ],
      learningDays: 1,
      totalLearningSeconds: 120,
      totalLessonCompletions: 1,
    });

    expect(currentUserActivityResponseSchema.parse({ activity }).activity.days).toStrictEqual([
      { activitiesCompleted: 3, date: "2025-01-05", lessonCompletions: 1, timeSpentSeconds: 120 },
    ]);
  });
});
