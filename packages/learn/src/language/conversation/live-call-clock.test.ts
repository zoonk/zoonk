import { describe, expect, it } from "vitest";
import { getCallLength, takeDueExamCue } from "./live-call-clock";
import { type LiveCallScript } from "./live-call-script";

const SCRIPT = { cues: {}, timing: {} } as LiveCallScript;
const ANSWERED_AT = 1_000_000;

describe(getCallLength, () => {
  it("starts a new call's clock as it goes live, with its talk time and hard stop from the answer", () => {
    const length = getCallLength({
      answeredAt: ANSWERED_AT,
      callSeconds: 120,
      setup: { continuesCall: false, script: SCRIPT, seconds: 130, talkSeconds: 119 },
    });

    expect(length).toStrictEqual({
      clockFrom: null,
      hardStopAt: ANSWERED_AT + 130_000,
      script: SCRIPT,
      talkEndsAt: ANSWERED_AT + 119_000,
    });
  });

  it("goes on with a continued call's clock from the talk time its earlier connections used", () => {
    const length = getCallLength({
      answeredAt: ANSWERED_AT,
      callSeconds: 120,
      setup: { continuesCall: true, script: SCRIPT, seconds: 83, talkSeconds: 73 },
    });

    expect(length).toMatchObject({
      clockFrom: ANSWERED_AT - 47_000,
      talkEndsAt: ANSWERED_AT + 73_000,
    });
  });
});

describe(takeDueExamCue, () => {
  const cues = [
    { atSeconds: 60, say: "first" },
    { atSeconds: 120, say: "second" },
    { atSeconds: 180, say: "third" },
  ];

  it("sends nothing before the next cue is due", () => {
    expect(takeDueExamCue({ cues, elapsedSeconds: 59, sent: 0 })).toBeNull();
    expect(takeDueExamCue({ cues, elapsedSeconds: 150, sent: 2 })).toBeNull();
  });

  it("sends a cue once, when it's due", () => {
    expect(takeDueExamCue({ cues, elapsedSeconds: 60, sent: 0 })).toStrictEqual({
      cue: cues[0],
      sent: 1,
    });

    expect(takeDueExamCue({ cues, elapsedSeconds: 61, sent: 1 })).toBeNull();
  });

  it("sends only the latest of the cues that came due while the call was down", () => {
    expect(takeDueExamCue({ cues, elapsedSeconds: 190, sent: 0 })).toStrictEqual({
      cue: cues[2],
      sent: 3,
    });

    expect(takeDueExamCue({ cues, elapsedSeconds: 190, sent: 3 })).toBeNull();
  });
});
