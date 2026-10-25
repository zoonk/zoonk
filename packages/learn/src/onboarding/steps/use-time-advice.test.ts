import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { describe, expect, it } from "vitest";
import {
  type AdviceAnswer,
  getEstimate,
  getPickedShare,
  getWeekAdvice,
  hasEstimate,
  keepsFullCourse,
  toFindWeek,
  toStudyWeek,
} from "./use-time-advice";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const ADVICE: PlanTimeAdvice = {
  coveredShare: 0.6,
  fullCourseEndDate: null,
  measure: "exam",
  numbers: null,
  readingNotice: false,
  ready: true,
  targetDate: "2026-11-08",
  targetDateNamedMonth: false,
};

/** What Find found for the week: the time that covers everything. */
const FOUND = { recommendedMinutes: 100 };

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
  it("knows only the exact time Find found covers everything without asking", () => {
    const answer = answerFor({ minutes: 45 });

    expect(getPickedShare({ advice: ADVICE, answer, found: FOUND, minutes: 100 })).toStrictEqual({
      known: true,
      share: 1,
    });

    expect(getPickedShare({ advice: ADVICE, answer, found: FOUND, minutes: 240 })).toStrictEqual({
      known: false,
      share: null,
    });
  });

  it("asks about every time until the learner finds the time that covers everything", () => {
    const answer = answerFor({ minutes: 45 });

    expect(getPickedShare({ advice: ADVICE, answer, found: null, minutes: 100 })).toStrictEqual({
      known: false,
      share: null,
    });
  });

  it("asks about every time when no time covers everything", () => {
    const found = { recommendedMinutes: null };

    expect(
      getPickedShare({ advice: ADVICE, answer: answerFor({ minutes: 60 }), found, minutes: 240 }),
    ).toStrictEqual({ known: false, share: null });
  });

  it("takes the plan's share only for the very time it was asked about", () => {
    const answer = answerFor({ minutes: 45 });

    expect(getPickedShare({ advice: ADVICE, answer, found: FOUND, minutes: 45 })).toStrictEqual({
      known: true,
      share: 0.6,
    });

    // Another time is asked about: the last share is that time's, not this one's.
    expect(getPickedShare({ advice: ADVICE, answer, found: FOUND, minutes: 60 })).toStrictEqual({
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
      const advice = { ...ADVICE, coveredShare: share };
      const answer = answerFor({ advice, minutes, studyDays: [0] });
      const found = { recommendedMinutes: 65 };

      expect(getPickedShare({ advice, answer, found, minutes })).toStrictEqual({
        known: true,
        share,
      });
    },
  );

  it.each([70, 90])(
    "asks about %i minutes even when 65 covers the whole Sunday exam",
    (minutes) => {
      const advice = { ...ADVICE, coveredShare: 1 };
      const answer = answerFor({ advice, minutes: 65, studyDays: [0] });
      const found = { recommendedMinutes: 65 };

      expect(getPickedShare({ advice, answer, found, minutes })).toStrictEqual({
        known: false,
        share: null,
      });
    },
  );

  it("prefers an exact answer over the time Find found", () => {
    const answer = answerFor({ minutes: 100 });

    expect(getPickedShare({ advice: ADVICE, answer, found: FOUND, minutes: 100 })).toStrictEqual({
      known: true,
      share: 0.6,
    });
  });

  it("knows nothing before the plan says its advice for the week shown", () => {
    expect(getPickedShare({ advice: null, answer: null, found: FOUND, minutes: 45 })).toStrictEqual(
      { known: false, share: null },
    );
  });
});

describe(toFindWeek, () => {
  it("keeps the weekend's own time for Find, even when it equals the weekday pick", () => {
    // The search then raises the weekdays alone, as picking the time it finds saves the week.
    expect(toFindWeek({ days: EVERY_DAY, weekend: "60" })).toStrictEqual({
      studyDays: EVERY_DAY,
      weekendMinutes: 60,
    });

    expect(toStudyWeek({ days: EVERY_DAY, minutes: "60", weekend: "60" })).toStrictEqual({
      studyDays: EVERY_DAY,
    });
  });

  it("asks about the days alone without a weekend time of its own", () => {
    expect(toFindWeek({ days: [1, 2, 3], weekend: null })).toStrictEqual({ studyDays: [1, 2, 3] });
  });
});

describe(toStudyWeek, () => {
  it("asks about studying everything only when it's on, so other weeks keep their answers", () => {
    expect(
      toStudyWeek({ days: [1, 2, 3], fullCourse: true, minutes: "60", weekend: null }),
    ).toStrictEqual({ fullCourse: true, studyDays: [1, 2, 3] });

    expect(
      toStudyWeek({ days: [1, 2, 3], fullCourse: false, minutes: "60", weekend: null }),
    ).toStrictEqual(toStudyWeek({ days: [1, 2, 3], minutes: "60", weekend: null }));
  });
});

describe(getWeekAdvice, () => {
  it("keeps the week's advice while another time a day is asked about, not another week", () => {
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

  it("says asking stopped, with a retry, even before the week's first advice", () => {
    const answer = answerFor({ minutes: 45 });

    expect(
      getEstimate({ advice: null, answer, pickedShare: unknown, status: "failed" }),
    ).toMatchObject({ failed: true, retry: true });
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

describe(keepsFullCourse, () => {
  it("keeps an exam's choice to study everything until the time picked is known to cover it all", () => {
    const week = toStudyWeek({ days: EVERY_DAY, fullCourse: true, minutes: "45", weekend: null });
    const advice = { ...ADVICE, coveredShare: 0.5 };
    const answer = { advice, key: JSON.stringify(week), minutes: 45 };
    const shareAt = (minutes: number) => getPickedShare({ advice, answer, found: null, minutes });

    // Another time, whose estimate never came (asking for it kept failing): her choice stands.
    expect(keepsFullCourse({ checked: true, pickedShare: shareAt(60) })).toBe(true);
    expect(keepsFullCourse({ checked: true, pickedShare: shareAt(45) })).toBe(true);
    expect(keepsFullCourse({ checked: false, pickedShare: shareAt(45) })).toBe(false);

    // Only a time the plan says covers everything leaves nothing to study after the exam.
    expect(keepsFullCourse({ checked: true, pickedShare: { known: true, share: 1 } })).toBe(false);
  });
});
