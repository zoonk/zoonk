import { describe, expect, it } from "vitest";
import {
  NO_CHECK_TIMING,
  REPLY_SETTLED_MS,
  hearFragment,
  isCheckDue,
  readTranscript,
} from "./objective-check-timing";

type Fragment = { at: number; speaker: "character" | "learner"; startMs?: number };

/** When the checks run for transcript fragments arriving at `at`. */
function checkTimes(fragments: Fragment[]) {
  const checks: number[] = [];
  let timing = NO_CHECK_TIMING;
  let settlesAt: number | null = null;

  const settle = (at: number) => {
    settlesAt = null;

    if (isCheckDue(timing)) {
      checks.push(at);
      timing = readTranscript(timing);
    }
  };

  for (const { at, ...fragment } of fragments) {
    if (settlesAt !== null && settlesAt <= at) {
      settle(settlesAt);
    }

    timing = hearFragment(timing, fragment);
    settlesAt = at + REPLY_SETTLED_MS;
  }

  if (settlesAt !== null) {
    settle(settlesAt);
  }

  return checks;
}

const GREETING: Fragment[] = [
  { at: 500, speaker: "character", startMs: 500 },
  { at: 1500, speaker: "character", startMs: 1500 },
];

describe(isCheckDue, () => {
  it("checks once the character's answer to the learner settles", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 4000, speaker: "learner", startMs: 2500 },
        { at: 5000, speaker: "learner", startMs: 3500 },
        { at: 5500, speaker: "character", startMs: 5000 },
        { at: 6000, speaker: "character", startMs: 5500 },
      ]),
    ).toStrictEqual([8000]);
  });

  it("doesn't check the greeting or learner words the character hasn't answered", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 4000, speaker: "learner", startMs: 2500 },
        { at: 5500, speaker: "character", startMs: 5000 },
        { at: 6200, speaker: "learner", startMs: 5800 },
      ]),
    ).toStrictEqual([]);
  });

  it("checks an exchange whose learner words came back only after the answer", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 6100, speaker: "character", startMs: 6000 },
        { at: 6500, speaker: "learner", startMs: 5000 },
      ]),
    ).toStrictEqual([8500]);
  });

  it("waits for the character's last words when late learner words follow a check", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 4000, speaker: "learner", startMs: 2500 },
        { at: 6000, speaker: "character", startMs: 5500 },
        { at: 8500, speaker: "learner", startMs: 5200 },
        { at: 8700, speaker: "character", startMs: 8300 },
        { at: 9300, speaker: "character", startMs: 8900 },
        { at: 9700, speaker: "character", startMs: 9300 },
        { at: 10_500, speaker: "character", startMs: 10_100 },
      ]),
    ).toStrictEqual([8000, 12_500]);
  });

  it("waits for the character to answer a typed reply, whatever older words come back", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 6100, speaker: "character", startMs: 6000 },
        { at: 6400, speaker: "learner" },
        { at: 6500, speaker: "learner", startMs: 5000 },
        { at: 9000, speaker: "character", startMs: 8500 },
      ]),
    ).toStrictEqual([11_000]);
  });

  it("reads one exchange once when the learner's last words come back 1.6 s after their first", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 5500, speaker: "learner", startMs: 4200 },
        { at: 6100, speaker: "character", startMs: 6000 },
        { at: 7700, speaker: "learner", startMs: 5900 },
      ]),
    ).toStrictEqual([9700]);
  });
});
