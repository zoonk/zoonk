import { describe, expect, it } from "vitest";
import { PAST_DATE, TOO_CLOSE, everythingAt, foundTime } from "../../_test-utils/time-answers";
import {
  asksAboutTime,
  getShownAnswer,
  getShownMinutes,
  keepsFullCourse,
  toFindWeek,
  toPickedMinutes,
  toStudyWeek,
  waitsForSuggestion,
  waitsToSave,
} from "./schedule-time";

describe(getShownMinutes, () => {
  const SHOWN = {
    fallback: 60,
    first: foundTime(),
    found: foundTime(),
    picked: null,
    settled: false,
  };

  it("shows nothing while the first time a dated goal needs is being worked out", () => {
    expect(getShownMinutes({ ...SHOWN, first: null, found: null })).toBeNull();
  });

  it("starts on the plan's suggestion and follows it as the days change", () => {
    expect(getShownMinutes(SHOWN)).toBe(35);
    expect(getShownMinutes({ ...SHOWN, found: foundTime(everythingAt(30)) })).toBe(30);
  });

  it("keeps the first suggestion when other days have none", () => {
    expect(getShownMinutes({ ...SHOWN, found: foundTime(TOO_CLOSE) })).toBe(35);
  });

  it("keeps the learner's own time over the suggestion", () => {
    expect(getShownMinutes({ ...SHOWN, picked: 90 })).toBe(90);
  });

  it("keeps the screen's own time when it started without a suggestion, whatever the days find later", () => {
    const tooClose = foundTime(TOO_CLOSE);

    expect(getShownMinutes({ ...SHOWN, first: tooClose, found: tooClose })).toBe(60);
    expect(getShownMinutes({ ...SHOWN, first: tooClose, found: foundTime() })).toBe(60);
  });

  it.each([
    { first: foundTime(PAST_DATE), settled: false },
    { first: null, settled: true },
  ])("falls back to the screen's own time when no suggestion comes: %o", ({ first, settled }) => {
    expect(getShownMinutes({ ...SHOWN, first, found: first, settled })).toBe(60);
  });
});

describe(waitsForSuggestion, () => {
  const WAITING = { failed: false, first: foundTime(), found: null, picked: null };

  it("waits while the suggestion shown is still the one for the days before", () => {
    expect(waitsForSuggestion(WAITING)).toBe(true);
  });

  it("goes on with the plan's answer for the days shown, or the learner's own time", () => {
    expect(waitsForSuggestion({ ...WAITING, found: foundTime({ recommendedMinutes: 50 }) })).toBe(
      false,
    );

    expect(waitsForSuggestion({ ...WAITING, picked: 35 })).toBe(false);
  });

  it("never waits for an answer that isn't coming, or on a time that doesn't follow one", () => {
    expect(waitsForSuggestion({ ...WAITING, failed: true })).toBe(false);
    expect(waitsForSuggestion({ ...WAITING, first: null })).toBe(false);
    expect(waitsForSuggestion({ ...WAITING, first: foundTime(PAST_DATE) })).toBe(false);
  });
});

describe(toPickedMinutes, () => {
  it("follows the suggestion again when the learner picks it back", () => {
    expect(toPickedMinutes({ first: foundTime(), found: foundTime(), minutes: 35 })).toBeNull();
  });

  it("keeps any other time as the learner's own", () => {
    expect(toPickedMinutes({ first: foundTime(), found: foundTime(), minutes: 30 })).toBe(30);
  });

  it("keeps the suggestion as the learner's own on a screen that started without one", () => {
    expect(toPickedMinutes({ first: foundTime(TOO_CLOSE), found: foundTime(), minutes: 35 })).toBe(
      35,
    );
  });
});

describe(asksAboutTime, () => {
  const ASK = { dated: true, found: foundTime(), fullCourse: false, minutes: 35 };

  it("asks about every time but the one the plan suggested", () => {
    expect(asksAboutTime(ASK)).toBe(false);
    expect(asksAboutTime({ ...ASK, minutes: 30 })).toBe(true);
  });

  it("asks about the suggested time too when studying everything needs its end", () => {
    expect(asksAboutTime({ ...ASK, fullCourse: true })).toBe(true);
  });

  it("asks an undated goal about its time right away", () => {
    expect(asksAboutTime({ ...ASK, dated: false, found: null })).toBe(true);
  });

  it("waits for the suggestion, and never asks about a date that has passed", () => {
    expect(asksAboutTime({ ...ASK, found: null })).toBe(false);
    expect(asksAboutTime({ ...ASK, minutes: null })).toBe(false);
    expect(asksAboutTime({ ...ASK, found: foundTime(PAST_DATE) })).toBe(false);
  });
});

describe(keepsFullCourse, () => {
  it("keeps an exam's choice to study everything until the time picked covers it all", () => {
    const covers = { kind: "everything", suggested: false } as const;

    expect(keepsFullCourse({ checked: true, line: { kind: "asking" } })).toBe(true);
    expect(keepsFullCourse({ checked: true, line: covers })).toBe(false);
    expect(keepsFullCourse({ checked: false, line: { kind: "share", share: 0.4 } })).toBe(false);
  });
});

describe(toStudyWeek, () => {
  it("leaves out a weekend time equal to the weekdays' and asks about studying everything only when on", () => {
    expect(toStudyWeek({ days: [1, 6], minutes: 30, weekend: 30 })).toStrictEqual({
      studyDays: [1, 6],
    });

    expect(toStudyWeek({ days: [1, 6], fullCourse: true, minutes: 30, weekend: 60 })).toStrictEqual(
      { fullCourse: true, studyDays: [1, 6], weekendMinutes: 60 },
    );
  });
});

describe(toFindWeek, () => {
  it("keeps the weekend's own time even when it equals the weekdays'", () => {
    expect(toFindWeek({ days: [0, 6], weekend: 30 })).toStrictEqual({
      studyDays: [0, 6],
      weekendMinutes: 30,
    });

    expect(toFindWeek({ days: [1, 2], weekend: null })).toStrictEqual({ studyDays: [1, 2] });
  });
});

describe(waitsToSave, () => {
  it("waits while the screen works out what a time the learner didn't pick covers", () => {
    expect(waitsToSave({ line: { kind: "asking" }, picked: null })).toBe(true);
    expect(waitsToSave({ line: { kind: "working" }, picked: null })).toBe(true);
  });

  it("saves a time the learner picked, even while it's being worked out", () => {
    expect(waitsToSave({ line: { kind: "asking" }, picked: 830 })).toBe(false);
  });

  it("saves the time shown once the screen says what it means, or that it couldn't", () => {
    expect(waitsToSave({ line: { kind: "share", share: 0.4 }, picked: null })).toBe(false);
    expect(waitsToSave({ line: { kind: "findFailed" }, picked: null })).toBe(false);
  });
});

describe(getShownAnswer, () => {
  const settled = { found: foundTime(), line: { kind: "share", share: 0.4 } } as const;
  const working = { found: null, line: { kind: "working" } } as const;

  it("keeps the last answer in place, updating, while new days are worked out", () => {
    expect(getShownAnswer({ last: settled, now: working })).toStrictEqual({
      ...settled,
      updating: true,
    });
  });

  it("shows the screen working when there's no answer yet, and the new one once it's in", () => {
    expect(getShownAnswer({ last: working, now: working })).toStrictEqual({
      ...working,
      updating: false,
    });

    const now = { found: foundTime(), line: { kind: "everything", suggested: true } } as const;
    expect(getShownAnswer({ last: settled, now })).toStrictEqual({ ...now, updating: false });
  });
});
