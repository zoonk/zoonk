import { describe, expect, test } from "vitest";
import { type LessonActivity } from "../get-lesson-activities-step";
import { findActivitiesByKind } from "./find-activity-by-kind";

function makeMockActivity(overrides: Partial<LessonActivity>): LessonActivity {
  return { id: 1, kind: "background", ...overrides } as LessonActivity;
}

describe(findActivitiesByKind, () => {
  test("returns all activities matching the given kind", () => {
    const activities = [
      makeMockActivity({ id: 1, kind: "explanation" }),
      makeMockActivity({ id: 2, kind: "background" }),
      makeMockActivity({ id: 3, kind: "explanation" }),
    ];

    const result = findActivitiesByKind(activities, "explanation");

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(1);
    expect(result[1]?.id).toBe(3);
  });

  test("returns empty array when no activities match", () => {
    const activities = [
      makeMockActivity({ id: 1, kind: "background" }),
      makeMockActivity({ id: 2, kind: "examples" }),
    ];

    const result = findActivitiesByKind(activities, "explanation");

    expect(result).toHaveLength(0);
  });

  test("maintains original order", () => {
    const activities = [
      makeMockActivity({ id: 10, kind: "quiz" }),
      makeMockActivity({ id: 5, kind: "explanation" }),
      makeMockActivity({ id: 20, kind: "quiz" }),
      makeMockActivity({ id: 3, kind: "quiz" }),
    ];

    const result = findActivitiesByKind(activities, "quiz");

    expect(result).toHaveLength(3);
    expect(result.map((a) => a.id)).toEqual([10, 20, 3]);
  });
});
