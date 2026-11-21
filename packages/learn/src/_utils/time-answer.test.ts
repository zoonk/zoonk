import {
  planTimeAdviceSchema,
  planTimeToCoverSchema,
} from "@zoonk/core/plans/time-advice-contract";
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
  getEverythingTakes,
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
    expect(getTimeLine(LINE)).toStrictEqual({ kind: "everything" });

    expect(getTimeLine({ ...LINE, found: foundTime(focusAt(805)), minutes: 240 })).toStrictEqual({
      kind: "share",
      share: 0.6,
    });
  });

  it("says what another time covers once the plan answers for it", () => {
    expect(getTimeLine({ ...LINE, minutes: 15 })).toStrictEqual({ kind: "asking" });

    expect(
      getTimeLine({
        ...LINE,
        advice: adviceAt({ coveredShare: 0.3, reachedShare: 0.45 }),
        minutes: 15,
      }),
    ).toStrictEqual({ kind: "share", share: 0.45 });

    expect(
      getTimeLine({ ...LINE, advice: adviceAt({ coveredShare: 1 }), minutes: 60 }),
    ).toStrictEqual({ kind: "everything" });
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

describe(getOffer, () => {
  const SHORT = { kind: "share", share: 0.48 } as const;

  it("offers a suggestion that covers everything back while a shorter time is shown", () => {
    expect(getOffer({ found: foundTime(), line: SHORT, minutes: 35 })).toBeNull();
    expect(getOffer({ found: foundTime(), line: SHORT, minutes: 15 })).toBe(35);
  });

  it("offers nothing to a time that already covers everything", () => {
    const covers = { kind: "everything" } as const;

    expect(
      getOffer({ found: foundTime(everythingAt(240)), line: covers, minutes: 900 }),
    ).toBeNull();
  });

  it("never offers another time beside a focus suggestion", () => {
    const found = foundTime(focusAt(805));
    const covers = { kind: "everything" } as const;

    expect(getOffer({ found, line: SHORT, minutes: 240 })).toBeNull();
    expect(getOffer({ found, line: SHORT, minutes: 120 })).toBeNull();
    expect(getOffer({ found, line: covers, minutes: 805 })).toBeNull();
  });
});

function plateauAt(minutes: number) {
  return foundTime({ ...focusAt(null), most: { coveredShare: 0.99, minutes } });
}

describe(getEverythingTakes, () => {
  it("says what covering everything takes beside a focus suggestion", () => {
    expect(getEverythingTakes(foundTime(focusAt(805)))).toStrictEqual({
      everything: true,
      minutes: 805,
    });
  });

  it("says the most any time covers when part never fits, or that nothing covers everything", () => {
    expect(getEverythingTakes(plateauAt(480))).toStrictEqual({ everything: false, minutes: 480 });

    expect(getEverythingTakes(foundTime(focusAt(null)))).toBeNull();
  });

  it("says nothing beside a suggestion that covers everything", () => {
    expect(getEverythingTakes(foundTime())).toBeUndefined();
    expect(getEverythingTakes(foundTime(TOO_CLOSE))).toBeUndefined();
  });
});

describe(getMarkedTimes, () => {
  it("marks only a time that covers everything as covering everything", () => {
    expect(getMarkedTimes(plateauAt(480))).toStrictEqual({ full: null, suggested: 240 });
    expect(getMarkedTimes(foundTime(focusAt(805)))).toStrictEqual({ full: 805, suggested: 240 });
    expect(getMarkedTimes(foundTime())).toStrictEqual({ full: null, suggested: 35 });
  });
});

describe("a line for a time whose coverage is already known", () => {
  it("says what the plan's own time reaches before the time question answers", () => {
    expect(
      getTimeLine({
        ...LINE,
        advice: adviceAt({ coveredShare: 0.29, reachedShare: 1 }),
        found: null,
        minutes: 120,
      }),
    ).toStrictEqual({ kind: "share", share: 1 });
  });
});

describe("an answer from an API that doesn't say what a time reaches", () => {
  const { reachedShare: _advised, ...advice } = adviceAt({ coveredShare: 0.3 });
  const { suggested } = focusAt(805);
  const { reachedShare: _suggested, ...focus } = suggested ?? {};

  it("reads, and says nothing about what the time reaches", () => {
    const older = planTimeAdviceSchema.parse(advice);
    const found = planTimeToCoverSchema.parse(foundTime({ ...focusAt(805), suggested: null }));
    const olderFound = planTimeToCoverSchema.parse({ ...found, suggested: focus });

    expect(getTimeLine({ ...LINE, advice: older, minutes: 15 })).toStrictEqual({
      kind: "share",
      share: null,
    });

    expect(getTimeLine({ ...LINE, found: olderFound, minutes: 240 })).toStrictEqual({
      kind: "share",
      share: null,
    });
  });
});
