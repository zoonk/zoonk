import { describe, expect, it } from "vitest";
import { parseLearnerView, stringifyLearnerView } from "./view-json";

describe(stringifyLearnerView, () => {
  it("brings dates back as dates, wherever they sit in the view", () => {
    const view = {
      goal: { targetDate: new Date("2026-11-08T00:00:00.000Z"), title: "IELTS" },
      session: {
        blocks: [{ position: 0, title: "Quick review" }],
        localDate: new Date("2026-10-15T00:00:00.000Z"),
        week: { days: [{ date: new Date("2026-10-13T00:00:00.000Z"), minutes: 20 }] },
      },
      weeklyChallenge: null,
    };

    expect(parseLearnerView(stringifyLearnerView(view))).toStrictEqual(view);
  });

  it("keeps an object that only looks like a date apart from one", () => {
    const view = { note: { $date: "2026-10-15", other: true }, text: "$date" };

    expect(parseLearnerView(stringifyLearnerView(view))).toStrictEqual(view);
  });
});
