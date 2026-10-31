import { describe, expect, it } from "vitest";
import {
  LINE,
  PAST_DATE,
  TOO_CLOSE,
  adviceAt,
  everythingAt,
  focusAt,
  foundTime,
} from "../_test-utils/time-answers";
import {
  getFullTimeNote,
  getMarkedTimes,
  getOffer,
  getSuggestedMinutes,
  getTimeLine,
} from "./time-answer";

describe(getSuggestedMinutes, () => {
  it("takes the plan's suggestion, or none while the plan hasn't answered", () => {
    expect(getSuggestedMinutes(foundTime(focusAt(805)))).toBe(240);
    expect(getSuggestedMinutes(foundTime(TOO_CLOSE))).toBeNull();
    expect(getSuggestedMinutes(null)).toBeNull();
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

describe(getFullTimeNote, () => {
  const SHORT = { kind: "share", share: 0.15 } as const;
  const FOCUS = foundTime(focusAt(805));

  it("says what everything takes only beside a focus suggestion", () => {
    expect(getFullTimeNote({ found: foundTime(), line: SHORT, studiesEveryDay: true })).toBeNull();

    expect(
      getFullTimeNote({ found: foundTime(PAST_DATE), line: SHORT, studiesEveryDay: true }),
    ).toBeNull();

    expect(getFullTimeNote({ found: FOCUS, line: SHORT, studiesEveryDay: true })).toStrictEqual({
      full: { coveredShare: 1, minutes: 805 },
      kind: "takes",
      moreDays: false,
    });
  });

  it("says more study days help while some days are left, even when no day covers it all", () => {
    expect(
      getFullTimeNote({ found: foundTime(focusAt(null)), line: SHORT, studiesEveryDay: false }),
    ).toStrictEqual({ full: null, kind: "takes", moreDays: true });
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

function plateauAt(minutes: number) {
  return foundTime({ ...focusAt(null), most: { coveredShare: 0.99, minutes } });
}

describe("a goal part of which never fits, whatever the time", () => {
  const SHORT = { kind: "share", share: 0.5 } as const;

  it("says what the most any time covers takes, without more study days, past four hours", () => {
    expect(
      getFullTimeNote({ found: plateauAt(480), line: SHORT, studiesEveryDay: false }),
    ).toStrictEqual({ full: { coveredShare: 0.99, minutes: 480 }, kind: "takes", moreDays: false });

    expect(getOffer({ found: plateauAt(480), line: SHORT, minutes: 240 })).toStrictEqual({
      kind: "full",
      minutes: 480,
    });
  });

  it("says nothing more once the suggestion already covers the most", () => {
    const found = foundTime({
      most: { coveredShare: 0.99, minutes: 195 },
      recommendedMinutes: null,
      suggested: { coveredShare: 0.99, everyTopic: true, kind: "focus", minutes: 195, split: null },
    });

    const line = getTimeLine({ ...LINE, found, minutes: 195 });

    expect(getFullTimeNote({ found, line, studiesEveryDay: false })).toBeNull();
    expect(getOffer({ found, line, minutes: 195 })).toBeNull();
  });

  it("marks only a time that covers everything as covering everything", () => {
    expect(getMarkedTimes(plateauAt(480))).toStrictEqual({ full: null, suggested: 240 });
    expect(getMarkedTimes(foundTime(focusAt(805)))).toStrictEqual({ full: 805, suggested: 240 });
  });
});

describe("a line for a time whose coverage is already known", () => {
  it("says what the plan's own time covers before the time question answers", () => {
    expect(
      getTimeLine({ ...LINE, advice: adviceAt({ coveredShare: 0.29 }), found: null, minutes: 120 }),
    ).toStrictEqual({ kind: "share", share: 0.29 });
  });
});
