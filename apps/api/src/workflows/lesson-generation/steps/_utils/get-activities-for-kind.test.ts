import { describe, expect, test } from "vitest";
import { getActivitiesForKind } from "./get-activities-for-kind";

describe(getActivitiesForKind, () => {
  test("creates one practice activity when a core lesson has fewer than three explanations", () => {
    const activities = getActivitiesForKind({
      coreActivities: [
        {
          goal: "spot the repeated pattern before turning it into a reusable rule",
          title: "Reading the pattern",
        },
        {
          goal: "turn the pattern into a rule you can apply to new cases",
          title: "Turning it into a rule",
        },
      ],
      customActivities: [],
      lessonKind: "core",
      lessonTitle: "Reading the pattern",
      targetLanguage: null,
    });

    expect(activities.map((activity) => activity.kind)).toEqual([
      "explanation",
      "explanation",
      "practice",
      "quiz",
      "review",
    ]);
  });

  test("creates two practice activities when a core lesson has three explanations", () => {
    const activities = getActivitiesForKind({
      coreActivities: [
        {
          goal: "spot the repeated pattern before turning it into a reusable rule",
          title: "Reading the pattern",
        },
        {
          goal: "connect each clue to the mechanism that produced it",
          title: "Connecting clue to mechanism",
        },
        {
          goal: "check whether the explanation still holds when the evidence changes",
          title: "Testing the explanation",
        },
      ],
      customActivities: [],
      lessonKind: "core",
      lessonTitle: "Reading the pattern",
      targetLanguage: null,
    });

    expect(
      activities.map((activity) => [activity.kind, activity.title, activity.description]),
    ).toEqual([
      [
        "explanation",
        "Reading the pattern",
        "spot the repeated pattern before turning it into a reusable rule",
      ],
      ["practice", null, null],
      [
        "explanation",
        "Connecting clue to mechanism",
        "connect each clue to the mechanism that produced it",
      ],
      [
        "explanation",
        "Testing the explanation",
        "check whether the explanation still holds when the evidence changes",
      ],
      ["practice", null, null],
      ["quiz", null, null],
      ["review", null, null],
    ]);
  });

  test("falls back to the lesson title when core planning returns no explanation titles", () => {
    const activities = getActivitiesForKind({
      coreActivities: [],
      customActivities: [],
      lessonKind: "core",
      lessonTitle: "Fallback lesson title",
      targetLanguage: null,
    });

    expect(activities[0]).toEqual({
      description: null,
      kind: "explanation",
      title: "Fallback lesson title",
    });
  });
});
