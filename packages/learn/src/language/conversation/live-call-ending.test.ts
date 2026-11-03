import { describe, expect, it } from "vitest";
import {
  type CallEndingEvent,
  type LiveCallTiming,
  getCallEndingView,
  startCallEnding,
  stepCallEnding,
} from "./live-call-ending";

const TIMING: LiveCallTiming = {
  answerWaitMs: 8000,
  characterQuietMs: 1500,
  checkInMs: 25_000,
  goodbyeQuietMs: 3000,
  goodbyeRetryMs: 8000,
  openingRetryMs: 5000,
  quietGoodbyeMs: 50_000,
  quietHintMs: 12_000,
};

const TICK_MS = 250;
const HANGOVER_MS = 1000;

function range(from: number, to: number, step: number) {
  return Array.from({ length: Math.ceil((to - from) / step) }, (_, index) => from + index * step);
}

function characterTalks(from: number, ms: number): CallEndingEvent[] {
  return range(from, from + ms, 300).map((at) => ({ at, startMs: at, type: "characterSpoke" }));
}

/** Microphone samples every 100 ms, still "speaking" for the platform's hangover. */
function learnerTalks(from: number, ms: number): CallEndingEvent[] {
  return [
    ...range(from, from + ms + HANGOVER_MS, 100).map((at): CallEndingEvent => ({
      at,
      speaking: true,
      type: "speech",
    })),
    { at: from + ms + HANGOVER_MS, speaking: false, type: "speech" },
  ];
}

function learnerTypes(from: number, ms: number): CallEndingEvent[] {
  return range(from, from + ms, 500).map((at) => ({ at, type: "typing" }));
}

function acknowledged(at: number, id = "goodbye-1"): CallEndingEvent {
  return { at, id, startMs: at, type: "acknowledged" };
}

function play({
  events,
  seconds = 165,
  talkSeconds,
  until,
}: {
  events: CallEndingEvent[];
  seconds?: number;
  talkSeconds: number;
  until: number;
}) {
  const start = startCallEnding({
    at: 0,
    hardStopAt: seconds * 1000,
    talkEndsAt: talkSeconds * 1000,
    timing: TIMING,
  });

  const ticks = range(TICK_MS, until + TICK_MS, TICK_MS).map((at): CallEndingEvent => ({
    at,
    type: "tick",
  }));

  const timeline = [...events, ...ticks].toSorted((first, second) => first.at - second.at);
  const log = start.commands.map((command) => ({ at: 0, ...command }));
  let { state } = start;

  for (const event of timeline) {
    const step = stepCallEnding(state, event);
    state = step.state;
    log.push(...step.commands.map((command) => ({ at: event.at, ...command })));
  }

  return {
    goodbyes: log.filter((entry) => entry.type === "goodbye"),
    hangUp: log.find((entry) => entry.type === "hangUp"),
    log,
    state,
  };
}

const GREETING = characterTalks(500, 2000);

function cueTimes(log: { at: number; type: string }[]) {
  return log.filter((entry) => entry.type === "cue").map((entry) => entry.at);
}

describe("the call's ending at its talk time", () => {
  it("sends the goodbye at once, as quiet context, while the learner is speaking", () => {
    const { goodbyes } = play({
      events: [...GREETING, ...learnerTalks(8000, 8000)],
      talkSeconds: 10,
      until: 20_000,
    });

    expect(goodbyes).toStrictEqual([
      { at: 10_000, cue: "goodbye", id: "goodbye-1", type: "goodbye", whileLearnerSpeaks: true },
    ]);
  });

  it("lets the character finish, then sends the goodbye when the learner answers", () => {
    const { goodbyes } = play({
      events: [...GREETING, ...characterTalks(9000, 3000), ...learnerTalks(14_000, 3000)],
      talkSeconds: 10,
      until: 20_000,
    });

    expect(goodbyes.map((entry) => entry.at)).toStrictEqual([14_000]);
  });

  it("gives an idle learner 8 s to answer after the character stopped", () => {
    const { goodbyes } = play({ events: GREETING, talkSeconds: 5, until: 19_000 });

    // The greeting's last words came at 2.3 s, so the character stopped at 3.8 s.
    expect(goodbyes.map((entry) => entry.at)).toStrictEqual([12_000]);
  });

  it("holds the goodbye while a reply is typed and sends it once the character answered it", () => {
    const typed = [...GREETING, ...learnerTypes(9000, 3000), { at: 12_500, type: "sent" } as const];

    const answered = play({
      events: [...typed, ...characterTalks(13_500, 1500)],
      talkSeconds: 10,
      until: 20_000,
    });

    const unanswered = play({ events: typed, talkSeconds: 10, until: 22_000 });

    // Sent with the reply, the goodbye was answered as part of it and never said (measured).
    expect(answered.goodbyes.map((entry) => entry.at)).toStrictEqual([16_250]);
    expect(unanswered.goodbyes.map((entry) => entry.at)).toStrictEqual([20_500]);
  });

  it("doesn't send the goodbye again while the learner gives a long answer", () => {
    const { goodbyes, hangUp } = play({
      events: [
        ...GREETING,
        ...learnerTalks(9000, 21_000),
        acknowledged(10_700),
        ...characterTalks(32_400, 2000),
      ],
      talkSeconds: 10,
      until: 45_000,
    });

    expect(goodbyes).toHaveLength(1);
    // The goodbye's last words came at 34.2 s.
    expect(hangUp).toStrictEqual({ at: 37_250, reason: "time", type: "hangUp" });
  });

  it("sends the goodbye once more when nothing happens after it", () => {
    const { goodbyes } = play({ events: GREETING, talkSeconds: 20, until: 40_000 });

    expect(goodbyes).toStrictEqual([
      { at: 20_000, cue: "goodbye", id: "goodbye-1", type: "goodbye", whileLearnerSpeaks: false },
      { at: 28_000, cue: "goodbye", id: "goodbye-2", type: "goodbye", whileLearnerSpeaks: false },
    ]);
  });
});

describe("hanging up after the goodbye", () => {
  const goodbye = [acknowledged(13_000), ...characterTalks(13_200, 2000)];

  it("hangs up 3 s after the goodbye when nothing else happens", () => {
    const { hangUp } = play({ events: [...GREETING, ...goodbye], talkSeconds: 5, until: 30_000 });

    expect(hangUp).toStrictEqual({ at: 18_000, reason: "time", type: "hangUp" });
  });

  it("waits while the learner keeps talking or typing", () => {
    const { hangUp } = play({
      events: [
        ...GREETING,
        ...goodbye,
        ...learnerTalks(15_500, 4500),
        ...learnerTypes(21_500, 6500),
      ],
      talkSeconds: 5,
      until: 40_000,
    });

    // The last keystroke came at 27.5 s.
    expect(hangUp?.at).toBe(30_500);
  });

  it("restarts its quiet window when the learner answers the goodbye and the character replies", () => {
    const { hangUp } = play({
      events: [
        ...GREETING,
        ...goodbye,
        ...learnerTalks(15_500, 1000),
        ...characterTalks(18_500, 1000),
      ],
      talkSeconds: 5,
      until: 30_000,
    });

    expect(hangUp?.at).toBe(22_500);
  });

  it("counts a goodbye whose words arrive just before its cue's acknowledgment", () => {
    const { hangUp } = play({
      events: [
        ...GREETING,
        { at: 12_600, startMs: 12_400, type: "characterSpoke" },
        { at: 12_800, id: "goodbye-1", startMs: 12_600, type: "acknowledged" },
      ],
      talkSeconds: 5,
      until: 30_000,
    });

    expect(hangUp).toStrictEqual({ at: 15_750, reason: "time", type: "hangUp" });
  });

  it("doesn't count words from before the goodbye cue took its place as the goodbye", () => {
    const { hangUp } = play({
      events: [
        ...GREETING,
        { at: 13_000, id: "goodbye-1", startMs: 13_000, type: "acknowledged" },
        { at: 13_100, startMs: 12_000, type: "characterSpoke" },
      ],
      talkSeconds: 5,
      until: 30_000,
    });

    expect(hangUp).toBeUndefined();
  });

  it("hangs up at the hard stop whatever is happening", () => {
    const { hangUp } = play({
      events: [...GREETING, ...learnerTalks(9000, 60_000)],
      seconds: 55,
      talkSeconds: 10,
      until: 70_000,
    });

    expect(hangUp).toStrictEqual({ at: 55_000, reason: "hardStop", type: "hangUp" });
  });
});

describe("what the objective check ends", () => {
  const exchange = [...GREETING, ...learnerTalks(4000, 3000), ...characterTalks(8400, 1600)];

  it("says goodbye with the goals-done cue once every goal is met", () => {
    const { goodbyes, log } = play({
      events: [
        ...exchange,
        {
          allMet: true,
          at: 11_500,
          goodbye: false,
          progress: false,
          snapshotAt: 11_400,
          type: "checked",
        },
        ...learnerTalks(13_000, 2000),
      ],
      talkSeconds: 120,
      until: 20_000,
    });

    expect(goodbyes).toStrictEqual([
      {
        at: 13_000,
        cue: "goodbyeDone",
        id: "goodbye-1",
        type: "goodbye",
        whileLearnerSpeaks: true,
      },
    ]);

    expect(log.filter((entry) => entry.type === "progress")).toHaveLength(0);
  });

  it("hangs up without a cue when the learner and the character said goodbye", () => {
    const { goodbyes, hangUp } = play({
      events: [
        ...exchange,
        {
          allMet: false,
          at: 13_000,
          goodbye: true,
          progress: true,
          snapshotAt: 11_500,
          type: "checked",
        },
      ],
      talkSeconds: 120,
      until: 20_000,
    });

    expect(goodbyes).toHaveLength(0);
    expect(hangUp).toStrictEqual({ at: 13_000, reason: "goodbye", type: "hangUp" });
  });

  it("drops a check's goodbye once the learner spoke after its transcript", () => {
    const { hangUp, log } = play({
      events: [
        ...exchange,
        ...learnerTalks(12_000, 1000),
        {
          allMet: false,
          at: 13_000,
          goodbye: true,
          progress: true,
          snapshotAt: 11_500,
          type: "checked",
        },
      ],
      talkSeconds: 120,
      until: 20_000,
    });

    const progress = log.filter((entry) => entry.type === "progress");

    expect(hangUp).toBeUndefined();
    expect(progress.map((entry) => entry.at)).toStrictEqual([13_000]);
  });

  const mutualGoodbye: CallEndingEvent = {
    allMet: false,
    at: 13_000,
    goodbye: true,
    progress: false,
    snapshotAt: 11_500,
    type: "checked",
  };

  it("skips the goodbye cue when both said goodbye after the talk time ran out", () => {
    const { goodbyes, hangUp } = play({
      events: [...exchange, mutualGoodbye],
      talkSeconds: 10,
      until: 25_000,
    });

    expect(goodbyes).toHaveLength(0);
    expect(hangUp).toStrictEqual({ at: 13_000, reason: "time", type: "hangUp" });
  });

  it("changes nothing once the goodbye cue went out", () => {
    const withCheck = play({ events: [...exchange, mutualGoodbye], talkSeconds: 6, until: 20_000 });
    const withoutCheck = play({ events: exchange, talkSeconds: 6, until: 20_000 });

    expect(withCheck.goodbyes[0]).toStrictEqual({
      at: 6000,
      cue: "goodbye",
      id: "goodbye-1",
      type: "goodbye",
      whileLearnerSpeaks: true,
    });

    expect(withCheck.log).toStrictEqual(withoutCheck.log);
  });
});

describe("a quiet learner", () => {
  it("is told to take their time at 12 s, checked on once at 25 s and told goodbye at 50 s", () => {
    const checkInSpeech = characterTalks(30_000, 1500);

    const { goodbyes, log, state } = play({
      events: [...GREETING, ...checkInSpeech],
      talkSeconds: 120,
      until: 60_000,
    });

    // The greeting's last words came at 2.3 s: the quiet stretch starts as the character stops.
    expect(getCallEndingView(state, 15_700).quietHint).toBe(false);
    expect(getCallEndingView(state, 15_800).quietHint).toBe(true);

    expect(log.filter((entry) => entry.type === "cue")).toStrictEqual([
      { at: 0, cue: "opening", id: "opening", type: "cue" },
      { at: 29_000, cue: "checkIn", type: "cue" },
    ]);

    expect(goodbyes).toStrictEqual([
      { at: 54_000, cue: "goodbye", id: "goodbye-1", type: "goodbye", whileLearnerSpeaks: false },
    ]);
  });

  it("is still checked on when their words come back after the character's short reply", () => {
    const { log } = play({
      events: [
        ...GREETING,
        ...learnerTalks(4000, 2000),
        { at: 7400, startMs: 7400, type: "characterSpoke" },
        { at: 7800, type: "learnerHeard" },
      ],
      talkSeconds: 120,
      until: 40_000,
    });

    // The stretch starts once the character's reply ended, at 8.9 s, not when the words came back.
    expect(cueTimes(log)).toStrictEqual([0, 34_000]);
  });

  it("is still checked on when the character answered over the end of their words", () => {
    const { log } = play({
      events: [
        ...GREETING,
        ...learnerTalks(4000, 4000),
        ...characterTalks(6500, 1800),
        { at: 8200, type: "learnerHeard" },
      ],
      talkSeconds: 120,
      until: 40_000,
    });

    // The character's last words came at 8 s, while the microphone still held the learner's voice.
    expect(cueTimes(log)).toStrictEqual([0, 34_500]);
  });

  it("isn't checked on after typing", () => {
    const { log } = play({
      events: [...GREETING, { at: 20_000, type: "typing" }],
      talkSeconds: 120,
      until: 60_000,
    });

    expect(log.filter((entry) => entry.type === "cue").map((entry) => entry.cue)).toStrictEqual([
      "opening",
    ]);
  });

  it("isn't checked on once the call is ending", () => {
    const { log } = play({ events: GREETING, talkSeconds: 20, until: 40_000 });

    expect(log.filter((entry) => entry.type === "cue").map((entry) => entry.cue)).toStrictEqual([
      "opening",
    ]);
  });
});

describe("the opening", () => {
  it("is sent once more only when the character stays silent after it arrived", () => {
    const opened = { at: 700, id: "opening", startMs: 600, type: "acknowledged" } as const;
    const silent = play({ events: [opened], talkSeconds: 120, until: 12_000 });

    // A slow session acknowledges and greets late: a second cue then would greet twice (measured).
    const slow = play({
      events: [
        { ...opened, at: 6700 },
        { at: 6700, startMs: 600, type: "characterSpoke" },
      ],
      talkSeconds: 120,
      until: 12_000,
    });

    expect(cueTimes(silent.log)).toStrictEqual([0, 5750]);
    expect(cueTimes(slow.log)).toStrictEqual([0]);

    // The SDK refuses an event id it already sent, so the retry carries its own.
    expect(silent.log.map((entry) => "id" in entry && entry.id)).toStrictEqual([
      "opening",
      "opening-retry",
    ]);
  });
});
