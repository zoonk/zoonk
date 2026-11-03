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
    ).toStrictEqual([7500]);
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
    ).toStrictEqual([8000]);
  });

  it("waits for the character's last words when late learner words follow a check", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 4000, speaker: "learner", startMs: 2500 },
        { at: 6000, speaker: "character", startMs: 5500 },
        { at: 8000, speaker: "learner", startMs: 5200 },
        { at: 8200, speaker: "character", startMs: 7800 },
        { at: 8800, speaker: "character", startMs: 8400 },
        { at: 9200, speaker: "character", startMs: 8800 },
        { at: 10_000, speaker: "character", startMs: 9600 },
      ]),
    ).toStrictEqual([7500, 11_500]);
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
    ).toStrictEqual([10_500]);
  });
});
