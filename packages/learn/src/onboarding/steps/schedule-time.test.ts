import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { describe, expect, it } from "vitest";
import {
  asksAboutTime,
  getFullTimeNote,
  getOffer,
  getShownMinutes,
  getSuggestedMinutes,
  getTimeLine,
  keepsFullCourse,
  toFindWeek,
  toPickedMinutes,
  toStudyWeek,
  waitsForSuggestion,
  waitsToSave,
} from "./schedule-time";

const PAST_DATE = { pastDate: true, recommendedMinutes: null, suggested: null };

const TOO_CLOSE = { recommendedMinutes: null, suggested: null };

function foundTime(time: Partial<PlanTimeToCover> = {}): PlanTimeToCover {
  return {
    fittingDate: null,
    pastDate: false,
    readingNotice: false,
    ready: true,
    recommendedMinutes: 35,
    suggested: { coveredShare: 1, everyTopic: true, kind: "everything", minutes: 35, split: null },
    targetDate: "2028-10-29",
    targetDateNamedMonth: false,
    ...time,
  };
}

function everythingAt(minutes: number): Partial<PlanTimeToCover> {
  return {
    recommendedMinutes: minutes,
    suggested: { coveredShare: 1, everyTopic: true, kind: "everything", minutes, split: null },
  };
}

function focusAt(recommendedMinutes: number | null): Partial<PlanTimeToCover> {
  return {
    recommendedMinutes,
    suggested: { coveredShare: 0.32, everyTopic: false, kind: "focus", minutes: 240, split: null },
  };
}

function adviceAt(advice: Partial<PlanTimeAdvice> = {}): PlanTimeAdvice {
  return {
    coveredShare: 0.48,
    endDate: null,
    fullCourseEndDate: null,
    measure: "goal",
    numbers: null,
    readingNotice: false,
    ready: true,
    targetDate: "2028-10-29",
    targetDateNamedMonth: false,
    ...advice,
  };
}

const LINE = {
  advice: null,
  askFailed: false,
  dated: true,
  findFailed: false,
  found: foundTime(),
  hasDays: true,
  minutes: 35,
};

describe(getSuggestedMinutes, () => {
  it("takes the plan's suggestion, or none while the plan hasn't answered", () => {
    expect(getSuggestedMinutes(foundTime(focusAt(805)))).toBe(240);
    expect(getSuggestedMinutes(foundTime(TOO_CLOSE))).toBeNull();
    expect(getSuggestedMinutes(null)).toBeNull();
  });
});

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

describe(getTimeLine, () => {
  it("asks for a study day before anything else", () => {
    expect(getTimeLine({ ...LINE, hasDays: false })).toStrictEqual({ kind: "noDays" });
  });

  it("says why the suggested time without asking the plan again", () => {
    expect(getTimeLine(LINE)).toStrictEqual({ kind: "everything", suggested: true });

    expect(getTimeLine({ ...LINE, found: foundTime(focusAt(805)), minutes: 240 })).toStrictEqual({
      coveredShare: 0.32,
      everyTopic: false,
      kind: "focus",
    });
  });

  it("says what another time covers once the plan answers for it", () => {
    expect(getTimeLine({ ...LINE, minutes: 15 })).toStrictEqual({ kind: "asking" });

    expect(getTimeLine({ ...LINE, advice: adviceAt(), minutes: 15 })).toStrictEqual({
      kind: "share",
      share: 0.48,
    });

    expect(
      getTimeLine({ ...LINE, advice: adviceAt({ coveredShare: 1 }), minutes: 60 }),
    ).toStrictEqual({ kind: "everything", suggested: false });
  });

  it("says the time is being worked out, or that it couldn't be", () => {
    expect(getTimeLine({ ...LINE, found: null, minutes: null })).toStrictEqual({ kind: "working" });

    expect(getTimeLine({ ...LINE, findFailed: true, found: null, minutes: 15 })).toStrictEqual({
      kind: "findFailed",
    });

    expect(getTimeLine({ ...LINE, askFailed: true, minutes: 15 })).toStrictEqual({
      kind: "askFailed",
    });
  });

  it("says a date that has passed instead of what any time covers by it", () => {
    expect(getTimeLine({ ...LINE, found: foundTime(PAST_DATE) })).toStrictEqual({
      kind: "pastDate",
    });
  });

  it("says when an undated goal would finish at the time picked", () => {
    const undated = { ...LINE, dated: false, found: null, minutes: 15 };

    expect(getTimeLine(undated)).toStrictEqual({ kind: "asking" });

    expect(
      getTimeLine({ ...undated, advice: adviceAt({ coveredShare: null, endDate: "2027-03-15" }) }),
    ).toStrictEqual({ endDate: "2027-03-15", kind: "finish" });

    expect(getTimeLine({ ...undated, advice: adviceAt({ coveredShare: null }) })).toStrictEqual({
      kind: "noFinish",
    });
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

describe(getFullTimeNote, () => {
  const SHORT = { kind: "share", share: 0.15 } as const;
  const FOCUS = foundTime(focusAt(805));

  it("says what everything takes only beside a focus suggestion", () => {
    expect(getFullTimeNote({ found: foundTime(), line: SHORT, studiesEveryDay: true })).toBeNull();

    expect(
      getFullTimeNote({ found: foundTime(PAST_DATE), line: SHORT, studiesEveryDay: true }),
    ).toBeNull();

    expect(getFullTimeNote({ found: FOCUS, line: SHORT, studiesEveryDay: true })).toStrictEqual({
      kind: "takes",
      minutes: 805,
      moreDays: false,
    });
  });

  it("says more study days help while some days are left, even when no day covers it all", () => {
    expect(
      getFullTimeNote({ found: foundTime(focusAt(null)), line: SHORT, studiesEveryDay: false }),
    ).toStrictEqual({ kind: "takes", minutes: null, moreDays: true });
  });

  it("says the time shown is more than most people keep up once it covers everything", () => {
    const covers = { kind: "everything", suggested: false } as const;

    expect(getFullTimeNote({ found: FOCUS, line: covers, studiesEveryDay: true })).toStrictEqual({
      kind: "tooLong",
    });
  });
});

describe(getOffer, () => {
  const SHORT = { kind: "share", share: 0.48 } as const;

  it("offers the suggestion back only while another time falls short", () => {
    expect(getOffer({ found: foundTime(), line: SHORT, minutes: 35 })).toBeNull();

    expect(getOffer({ found: foundTime(), line: SHORT, minutes: 15 })).toStrictEqual({
      kind: "everything",
      minutes: 35,
    });
  });

  it("offers nothing to a time that already covers everything", () => {
    const covers = { kind: "everything", suggested: false } as const;
    const found = foundTime(everythingAt(240));

    expect(getOffer({ found, line: covers, minutes: 900 })).toBeNull();
  });

  it("offers the time that covers everything beside a focus, and the focus beside any other", () => {
    const found = foundTime(focusAt(805));
    const covers = { kind: "everything", suggested: false } as const;
    const focus = getTimeLine({ ...LINE, found, minutes: 240 });

    expect(getOffer({ found, line: focus, minutes: 240 })).toStrictEqual({
      kind: "full",
      minutes: 805,
    });

    expect(getOffer({ found, line: covers, minutes: 805 })).toStrictEqual({
      kind: "focus",
      minutes: 240,
    });

    expect(getOffer({ found, line: SHORT, minutes: 120 })).toStrictEqual({
      kind: "focus",
      minutes: 240,
    });

    expect(getOffer({ found: foundTime(focusAt(null)), line: focus, minutes: 240 })).toBeNull();
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
