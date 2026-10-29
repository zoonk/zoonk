import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { describe, expect, it } from "vitest";
import {
  type FoundTime,
  asksAboutTime,
  getOffer,
  getShownMinutes,
  getSuggestedMinutes,
  getTimeLine,
  getTooClose,
  keepsFullCourse,
  toFindWeek,
  toPickedMinutes,
  toStudyWeek,
} from "./schedule-time";

function foundTime(time: Partial<FoundTime> = {}): FoundTime {
  return {
    coreMinutes: null,
    fittingDate: null,
    pastDate: false,
    readingNotice: false,
    ready: true,
    recommendedMinutes: 35,
    targetDate: "2028-10-29",
    targetDateNamedMonth: false,
    ...time,
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
  it("suggests the time that covers everything, up to four hours a day", () => {
    expect(getSuggestedMinutes(foundTime({ recommendedMinutes: 240 }))).toBe(240);
  });

  it("suggests the time that reaches every topic when covering everything takes longer", () => {
    expect(getSuggestedMinutes(foundTime({ coreMinutes: 45, recommendedMinutes: 300 }))).toBe(45);
  });

  it.each([
    { coreMinutes: 300, recommendedMinutes: 900 },
    { coreMinutes: null, recommendedMinutes: null },
    { pastDate: true },
  ])("suggests nothing a day can't sensibly hold, or for a date that has passed: %o", (time) => {
    expect(getSuggestedMinutes(foundTime(time))).toBeNull();
  });
});

describe(getShownMinutes, () => {
  const TOO_CLOSE = foundTime({ coreMinutes: 300, recommendedMinutes: 900 });

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
    expect(getShownMinutes({ ...SHOWN, found: foundTime({ recommendedMinutes: 30 }) })).toBe(30);
  });

  it("keeps the first suggestion when other days have none", () => {
    expect(getShownMinutes({ ...SHOWN, found: TOO_CLOSE })).toBe(35);
  });

  it("keeps the learner's own time over the suggestion", () => {
    expect(getShownMinutes({ ...SHOWN, picked: 90 })).toBe(90);
  });

  it("keeps the screen's own time when it started without a suggestion, whatever the days find later", () => {
    expect(getShownMinutes({ ...SHOWN, first: TOO_CLOSE, found: TOO_CLOSE })).toBe(60);
    expect(getShownMinutes({ ...SHOWN, first: TOO_CLOSE, found: foundTime() })).toBe(60);
  });

  it.each([
    { first: foundTime({ pastDate: true, recommendedMinutes: null }), settled: false },
    { first: null, settled: true },
  ])("falls back to the screen's own time when no suggestion comes: %o", ({ first, settled }) => {
    expect(getShownMinutes({ ...SHOWN, first, found: first, settled })).toBe(60);
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
    const tooClose = foundTime({ coreMinutes: 300, recommendedMinutes: 900 });
    expect(toPickedMinutes({ first: tooClose, found: foundTime(), minutes: 35 })).toBe(35);
  });
});

describe(getTimeLine, () => {
  it("asks for a study day before anything else", () => {
    expect(getTimeLine({ ...LINE, hasDays: false })).toStrictEqual({ kind: "noDays" });
  });

  it("says why the suggested time without asking the plan again", () => {
    expect(getTimeLine(LINE)).toStrictEqual({ kind: "everything", suggested: true });

    expect(
      getTimeLine({
        ...LINE,
        found: foundTime({ coreMinutes: 45, recommendedMinutes: 300 }),
        minutes: 45,
      }),
    ).toStrictEqual({ kind: "everyTopic" });
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
    expect(
      getTimeLine({ ...LINE, found: foundTime({ pastDate: true, recommendedMinutes: null }) }),
    ).toStrictEqual({ kind: "pastDate" });
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
    expect(asksAboutTime({ ...ASK, found: foundTime({ pastDate: true }) })).toBe(false);
  });
});

describe(getTooClose, () => {
  const SHORT = { kind: "share", share: 0.15 } as const;
  const TOO_CLOSE = foundTime({ coreMinutes: 300, recommendedMinutes: 900 });

  it("says why only when no sensible time covers everything", () => {
    expect(getTooClose({ found: foundTime(), line: SHORT })).toBeNull();
    expect(getTooClose({ found: foundTime({ pastDate: true }), line: SHORT })).toBeNull();

    expect(getTooClose({ found: TOO_CLOSE, line: SHORT })).toStrictEqual({
      recommendedMinutes: 900,
    });
  });

  it("says nothing once the time picked covers everything anyway", () => {
    const covers = { kind: "everything", suggested: false } as const;
    expect(getTooClose({ found: TOO_CLOSE, line: covers })).toBeNull();
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
    const found = foundTime({ coreMinutes: 240, recommendedMinutes: 900 });

    expect(getOffer({ found, line: covers, minutes: 900 })).toBeNull();
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
