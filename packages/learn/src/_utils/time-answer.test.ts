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
import { getOffer, getSuggestedMinutes, getTimeLine } from "./time-answer";

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

  it("says the suggestion, whatever time is picked", () => {
    const suggestion = { focus: false, kind: "suggestion", minutes: 35 };

    expect(getTimeLine(LINE)).toStrictEqual(suggestion);
    expect(getTimeLine({ ...LINE, minutes: 15 })).toStrictEqual(suggestion);
    expect(getTimeLine({ ...LINE, minutes: 480 })).toStrictEqual(suggestion);
  });

  it("says a capped suggestion starts with what matters most", () => {
    expect(getTimeLine({ ...LINE, found: foundTime(focusAt(805)), minutes: 60 })).toStrictEqual({
      focus: true,
      kind: "suggestion",
      minutes: 240,
    });
  });

  it("says the time is being worked out, or that it couldn't be", () => {
    expect(getTimeLine({ ...LINE, found: null, minutes: null })).toStrictEqual({ kind: "working" });
    expect(getTimeLine({ ...LINE, found: null })).toStrictEqual({ kind: "working" });

    expect(getTimeLine({ ...LINE, findFailed: true, found: null })).toStrictEqual({
      kind: "findFailed",
    });

    expect(getTimeLine({ ...LINE, found: foundTime(TOO_CLOSE) })).toStrictEqual({
      kind: "findFailed",
    });
  });

  it("says a date that has passed instead of a suggestion", () => {
    expect(getTimeLine({ ...LINE, found: foundTime(PAST_DATE) })).toStrictEqual({
      kind: "pastDate",
    });
  });

  it("says when an undated goal would finish at the time picked", () => {
    const undated = { ...LINE, dated: false, found: null, minutes: 15 };

    expect(getTimeLine(undated)).toStrictEqual({ kind: "asking" });
    expect(getTimeLine({ ...undated, askFailed: true })).toStrictEqual({ kind: "askFailed" });

    expect(getTimeLine({ ...undated, advice: adviceAt({ endDate: "2027-03-15" }) })).toStrictEqual({
      endDate: "2027-03-15",
      kind: "finish",
    });

    expect(getTimeLine({ ...undated, advice: adviceAt() })).toStrictEqual({ kind: "noFinish" });
  });
});

function lineAt(found: ReturnType<typeof foundTime>) {
  return getTimeLine({ ...LINE, found });
}

describe(getOffer, () => {
  it("offers the suggestion while a shorter time is picked", () => {
    expect(getOffer({ line: lineAt(foundTime()), minutes: 15 })).toBe(35);
    expect(getOffer({ line: lineAt(foundTime(focusAt(805))), minutes: 120 })).toBe(240);
  });

  it("offers nothing at the suggestion or above it", () => {
    expect(getOffer({ line: lineAt(foundTime()), minutes: 35 })).toBeNull();
    expect(getOffer({ line: lineAt(foundTime(everythingAt(120))), minutes: 480 })).toBeNull();
  });

  it("offers nothing without a suggestion", () => {
    expect(getOffer({ line: lineAt(foundTime(PAST_DATE)), minutes: 15 })).toBeNull();
    expect(getOffer({ line: { kind: "working" }, minutes: 15 })).toBeNull();
  });
});
