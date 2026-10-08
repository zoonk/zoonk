import { describe, expect, it } from "vitest";
import { type SkillMemory } from "./fsrs-scheduler";
import { forecastReviewLoad, getDailyReviewCap, selectDueReviews } from "./review-load";

function candidate({
  due,
  lastReviewedAt,
  skillId,
  stability = 3,
}: {
  due: string;
  lastReviewedAt: string;
  skillId: string;
  stability?: number;
}) {
  const memory: SkillMemory = {
    difficulty: 5,
    due: new Date(due),
    lapses: 0,
    lastReviewedAt: new Date(lastReviewedAt),
    recallDays: 0,
    reps: 2,
    stability,
    state: "learning",
  };

  return { memory, skillId };
}

describe(getDailyReviewCap, () => {
  it("gives about a third of the daily time to reviews, within limits", () => {
    expect(getDailyReviewCap({ dailyMinutes: 20 })).toBe(8);
    expect(getDailyReviewCap({ dailyMinutes: 45 })).toBe(18);
    expect(getDailyReviewCap({ dailyMinutes: 5 })).toBe(3);
    expect(getDailyReviewCap({ dailyMinutes: 180 })).toBe(30);
  });
});

describe(selectDueReviews, () => {
  const until = new Date("2026-09-10T03:00:00Z");

  it("picks due skills most at risk first and stops at the cap", () => {
    const candidates = [
      candidate({
        due: "2026-09-09T03:00:00Z",
        lastReviewedAt: "2026-09-06T12:00:00Z",
        skillId: "recent",
      }),
      candidate({
        due: "2026-09-03T03:00:00Z",
        lastReviewedAt: "2026-08-20T12:00:00Z",
        skillId: "oldest",
      }),
      candidate({
        due: "2026-09-12T03:00:00Z",
        lastReviewedAt: "2026-09-08T12:00:00Z",
        skillId: "notDue",
      }),
      candidate({
        due: "2026-09-05T03:00:00Z",
        lastReviewedAt: "2026-08-30T12:00:00Z",
        skillId: "middle",
      }),
    ];

    const picked = selectDueReviews({ candidates, cap: 2, until });

    expect(picked.map(({ skillId }) => skillId)).toStrictEqual(["oldest", "middle"]);
  });
});

describe(forecastReviewLoad, () => {
  it("spreads a backlog over the next days under the cap instead of piling it on one", () => {
    const overdue = Array.from({ length: 7 }, (_, index) =>
      candidate({
        due: "2026-09-01T03:00:00Z",
        lastReviewedAt: "2026-08-25T12:00:00Z",
        skillId: `skill-${index}`,
      }),
    );

    const forecast = forecastReviewLoad({
      candidates: overdue,
      cap: 3,
      days: 4,
      from: new Date("2026-09-10T00:00:00Z"),
      timeZone: "America/Sao_Paulo",
    });

    expect(forecast.map((day) => day.reviews)).toStrictEqual([3, 3, 1, 0]);
    expect(forecast[0]?.localDate).toStrictEqual(new Date("2026-09-10T00:00:00Z"));
  });

  it("adds skills on the day they fall due", () => {
    const forecast = forecastReviewLoad({
      candidates: [
        candidate({
          due: "2026-09-12T03:00:00Z",
          lastReviewedAt: "2026-09-08T12:00:00Z",
          skillId: "friday",
        }),
      ],
      cap: 5,
      days: 3,
      from: new Date("2026-09-10T00:00:00Z"),
      timeZone: "America/Sao_Paulo",
    });

    expect(forecast.map((day) => day.reviews)).toStrictEqual([0, 0, 1]);
  });
});
