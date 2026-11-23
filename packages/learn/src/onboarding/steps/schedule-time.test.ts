import { describe, expect, it } from "vitest";
import { PAST_DATE, TOO_CLOSE, everythingAt, foundTime } from "../../_test-utils/time-answers";
import {
  asksAboutTime,
  getShownLine,
  getShownMinutes,
  toFindWeek,
  toPickedMinutes,
  toStudyWeek,
  waitsForSuggestion,
  waitsToSave,
} from "./schedule-time";

const SUGGESTION = { focus: false, kind: "suggestion", minutes: 35 } as const;

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

  it("opens on the recommended time when the screen starts on it, whatever the plan suggests", () => {
    expect(getShownMinutes({ ...SHOWN, first: null, settled: true })).toBe(60);
    expect(getShownMinutes({ ...SHOWN, first: null, picked: 35, settled: true })).toBe(35);
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

  it("keeps the suggestion as the learner's own on a screen that started on the recommended time", () => {
    expect(toPickedMinutes({ first: null, found: foundTime(), minutes: 35 })).toBe(35);
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
  it("never asks about a dated goal's time: its line is the suggestion, whatever is picked", () => {
    expect(asksAboutTime({ dated: true, minutes: 35 })).toBe(false);
    expect(asksAboutTime({ dated: true, minutes: 480 })).toBe(false);
  });

  it("asks when an undated goal would finish at the time shown", () => {
    expect(asksAboutTime({ dated: false, minutes: 30 })).toBe(true);
    expect(asksAboutTime({ dated: false, minutes: null })).toBe(false);
  });
});

describe(toStudyWeek, () => {
  it("leaves out a weekend time equal to the weekdays'", () => {
    expect(toStudyWeek({ days: [1, 6], minutes: 30, weekend: 30 })).toStrictEqual({
      studyDays: [1, 6],
    });

    expect(toStudyWeek({ days: [1, 6], minutes: 30, weekend: 60 })).toStrictEqual({
      studyDays: [1, 6],
      weekendMinutes: 60,
    });
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
  it("waits while the screen works out what the time shown means", () => {
    expect(waitsToSave({ line: { kind: "asking" }, picked: null })).toBe(true);
    expect(waitsToSave({ line: { kind: "working" }, picked: null })).toBe(true);
  });

  it("saves a time the learner picked, even while it's being worked out", () => {
    expect(waitsToSave({ line: { kind: "asking" }, picked: 830 })).toBe(false);
  });

  it("saves the time shown once the screen says what it means, or that it couldn't", () => {
    expect(waitsToSave({ line: SUGGESTION, picked: null })).toBe(false);
    expect(waitsToSave({ line: { kind: "findFailed" }, picked: null })).toBe(false);
  });
});

describe(getShownLine, () => {
  const working = { kind: "working" } as const;

  it("keeps the last line in place, updating, while new days are worked out", () => {
    expect(getShownLine({ last: SUGGESTION, now: working })).toStrictEqual({
      line: SUGGESTION,
      updating: true,
    });
  });

  it("shows the screen working when there's no line yet, and the new one once it's in", () => {
    expect(getShownLine({ last: working, now: working })).toStrictEqual({
      line: working,
      updating: false,
    });

    const now = { focus: true, kind: "suggestion", minutes: 240 } as const;
    expect(getShownLine({ last: SUGGESTION, now })).toStrictEqual({ line: now, updating: false });
  });
});
