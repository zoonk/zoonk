import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { describe, expect, it } from "vitest";
import {
  type AdviceAnswer,
  getEstimate,
  getPickedShare,
  getWeekAdvice,
  hasEstimate,
  toStudyWeek,
} from "./use-time-advice";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const ADVICE: PlanTimeAdvice = {
  coveredShare: 0.6,
  maximum: null,
  measure: "exam",
  numbers: null,
  readingNotice: false,
  ready: true,
  recommendedMinutes: 100,
  targetDate: "2026-11-08",
  targetDateNamedMonth: false,
};

function answerFor({
  advice = ADVICE,
  minutes,
  studyDays = EVERY_DAY,
}: {
  advice?: PlanTimeAdvice;
  minutes: number;
  studyDays?: number[];
}): AdviceAnswer {
  return {
    advice,
    key: JSON.stringify(toStudyWeek({ days: studyDays, minutes: "60", weekend: null })),
    minutes,
  };
}

describe(getPickedShare, () => {
  it("knows only the exact recommended time covers everything without asking", () => {
    const answer = answerFor({ minutes: 45 });

    expect(getPickedShare({ advice: ADVICE, answer, minutes: 100 })).toStrictEqual({
      known: true,
      share: 1,
    });

    expect(getPickedShare({ advice: ADVICE, answer, minutes: 240 })).toStrictEqual({
      known: false,
      share: null,
    });
  });

  it("says what the most time covers when no time covers everything", () => {
    const advice = {
      ...ADVICE,
      maximum: { coveredShare: 0.7, dailyMinutes: 240 },
      recommendedMinutes: null,
    };

    expect(
      getPickedShare({ advice, answer: answerFor({ advice, minutes: 60 }), minutes: 240 }),
    ).toStrictEqual({ known: true, share: 0.7 });
  });

  it("takes the plan's share only for the very time it was asked about", () => {
    const answer = answerFor({ minutes: 45 });

    expect(getPickedShare({ advice: ADVICE, answer, minutes: 45 })).toStrictEqual({
      known: true,
      share: 0.6,
    });

    // Another time is asked about: the last share is that time's, not this one's.
    expect(getPickedShare({ advice: ADVICE, answer, minutes: 60 })).toStrictEqual({
      known: false,
      share: null,
    });
  });

  it.each([
    { minutes: 65, share: 1 },
    { minutes: 70, share: 9 / 14 },
    { minutes: 90, share: 12 / 14 },
  ])(
    "uses exact Sunday exam coverage at $minutes minutes instead of extrapolating",
    ({ minutes, share }) => {
      // The 69-minute mock begins at 70 minutes, reducing the fourteen lessons that fit.
      const advice = { ...ADVICE, coveredShare: share, recommendedMinutes: 65 };
      const answer = answerFor({ advice, minutes, studyDays: [0] });

      expect(getPickedShare({ advice, answer, minutes })).toStrictEqual({ known: true, share });
    },
  );

  it.each([70, 90])(
    "asks about %i minutes even when 65 covers the whole Sunday exam",
    (minutes) => {
      const advice = { ...ADVICE, coveredShare: 1, recommendedMinutes: 65 };
      const answer = answerFor({ advice, minutes: 65, studyDays: [0] });

      expect(getPickedShare({ advice, answer, minutes })).toStrictEqual({
        known: false,
        share: null,
      });
    },
  );

  it("prefers an exact answer over the recommendation guarantee", () => {
    const answer = answerFor({ minutes: 100 });

    expect(getPickedShare({ advice: ADVICE, answer, minutes: 100 })).toStrictEqual({
      known: true,
      share: 0.6,
    });
  });

  it("uses maximum coverage only for its exact input and prefers the picked answer", () => {
    const advice = {
      ...ADVICE,
      coveredShare: 0.5,
      maximum: { coveredShare: 0.7, dailyMinutes: 120 },
      recommendedMinutes: null,
    };

    expect(
      getPickedShare({ advice, answer: answerFor({ advice, minutes: 60 }), minutes: 180 }),
    ).toStrictEqual({ known: false, share: null });

    expect(
      getPickedShare({ advice, answer: answerFor({ advice, minutes: 120 }), minutes: 120 }),
    ).toStrictEqual({ known: true, share: 0.5 });
  });

  it("knows nothing before the plan says its advice for the week shown", () => {
    expect(getPickedShare({ advice: null, answer: null, minutes: 45 })).toStrictEqual({
      known: false,
      share: null,
    });
  });
});

describe(getWeekAdvice, () => {
  it("keeps the recommendation while another time a day is asked about, not another week", () => {
    const answer = answerFor({ minutes: 45 });
    const week = toStudyWeek({ days: EVERY_DAY, minutes: "90", weekend: null });
    const weekdays = toStudyWeek({ days: [1, 2, 3, 4, 5], minutes: "90", weekend: null });

    expect(getWeekAdvice({ answer, week })).toBe(ADVICE);
    expect(getWeekAdvice({ answer, week: weekdays })).toBeNull();
  });

  it("waits while the plan is still being built", () => {
    const answer = answerFor({ advice: { ...ADVICE, ready: false }, minutes: 45 });
    const week = toStudyWeek({ days: EVERY_DAY, minutes: "45", weekend: null });

    expect(getWeekAdvice({ answer, week })).toBeNull();
  });
});

describe(getEstimate, () => {
  const unknown = { known: false, share: null };

  it("shows the share of the time picked", () => {
    const answer = answerFor({ minutes: 45 });

    expect(
      getEstimate({
        advice: ADVICE,
        answer,
        pickedShare: { known: true, share: 0.6 },
        status: "idle",
      }),
    ).toStrictEqual({
      advice: ADVICE,
      failed: false,
      retry: false,
      share: 0.6,
      stale: false,
      staleMinutes: null,
    });
  });

  it("keeps the last share, dimmed, while another time is asked about", () => {
    const answer = answerFor({ minutes: 45 });

    expect(
      getEstimate({ advice: ADVICE, answer, pickedShare: unknown, status: "polling" }),
    ).toStrictEqual({
      advice: ADVICE,
      failed: false,
      retry: false,
      share: 0.6,
      stale: true,
      staleMinutes: 45,
    });
  });

  it("keeps the last advice while another week is asked about", () => {
    const answer = answerFor({ minutes: 45 });

    expect(
      getEstimate({ advice: null, answer, pickedShare: unknown, status: "polling" }),
    ).toMatchObject({ advice: ADVICE, share: 0.6, stale: true });
  });

  it("has no share before the plan's first answer", () => {
    expect(
      getEstimate({ advice: null, answer: null, pickedShare: unknown, status: "polling" }),
    ).toMatchObject({ advice: null, share: null, stale: true, staleMinutes: null });
  });

  it("says asking for the time picked stopped, with a retry, while the week's advice holds", () => {
    const answer = answerFor({ minutes: 45 });

    for (const status of ["failed", "timedOut"] as const) {
      expect(getEstimate({ advice: ADVICE, answer, pickedShare: unknown, status })).toStrictEqual({
        advice: ADVICE,
        failed: true,
        retry: true,
        share: 0.6,
        stale: true,
        staleMinutes: 45,
      });
    }
  });

  it("leaves the retry to the sentence when the week's advice failed too", () => {
    const answer = answerFor({ minutes: 45 });

    expect(
      getEstimate({ advice: null, answer, pickedShare: unknown, status: "failed" }),
    ).toMatchObject({ failed: true, retry: false });
  });
});

describe(hasEstimate, () => {
  const none = { retry: false, share: null };

  it("shows the estimate while the first share is on its way", () => {
    expect(
      hasEstimate({
        estimate: none,
        pickedShare: { known: false, share: null },
        status: "polling",
      }),
    ).toBe(true);
  });

  it("leaves it out for a plan that says no share, and once asking failed without one", () => {
    expect(
      hasEstimate({ estimate: none, pickedShare: { known: true, share: null }, status: "idle" }),
    ).toBe(false);

    expect(
      hasEstimate({ estimate: none, pickedShare: { known: false, share: null }, status: "failed" }),
    ).toBe(false);
  });

  it("keeps a share it already showed when asking for the next one fails", () => {
    expect(
      hasEstimate({
        estimate: { retry: true, share: 0.6 },
        pickedShare: { known: false, share: null },
        status: "timedOut",
      }),
    ).toBe(true);
  });

  it("shows the failure and its retry for the time picked even without a share to keep", () => {
    expect(
      hasEstimate({
        estimate: { retry: true, share: null },
        pickedShare: { known: false, share: null },
        status: "failed",
      }),
    ).toBe(true);
  });
});
