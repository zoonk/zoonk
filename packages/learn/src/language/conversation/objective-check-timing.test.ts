import { describe, expect, it } from "vitest";
import {
  type CheckTimingEvent,
  NO_CHECK_TIMING,
  REPLY_SETTLED_MS,
  stepCheckTiming,
} from "./objective-check-timing";

type Fragment = { at: number } & Exclude<CheckTimingEvent, { type: "checked" }>;

/** When the checks run for transcript fragments arriving at `at`. */
function checkTimes(fragments: Fragment[]) {
  const checks: number[] = [];
  let timing = NO_CHECK_TIMING;
  let due: number | null = null;

  const fire = (at: number) => {
    checks.push(at);
    due = null;
    timing = stepCheckTiming(timing, { type: "checked" }).timing;
  };

  for (const { at, ...event } of fragments) {
    if (due !== null && due <= at) {
      fire(due);
    }

    const step = stepCheckTiming(timing, event);
    timing = step.timing;

    if (step.settle === "restart") {
      due = at + REPLY_SETTLED_MS;
    }

    if (step.settle === "cancel") {
      due = null;
    }
  }

  if (due !== null) {
    fire(due);
  }

  return checks;
}

const GREETING: Fragment[] = [
  { at: 500, startMs: 500, type: "character" },
  { at: 1500, startMs: 1500, type: "character" },
];

describe(stepCheckTiming, () => {
  it("checks once the character's answer to the learner settles", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 4000, startMs: 2500, type: "learner" },
        { at: 5000, startMs: 3500, type: "learner" },
        { at: 5500, startMs: 5000, type: "character" },
        { at: 6000, startMs: 5500, type: "character" },
      ]),
    ).toStrictEqual([7500]);
  });

  it("doesn't check while the learner keeps talking after the character's words", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 4000, startMs: 2500, type: "learner" },
        { at: 5500, startMs: 5000, type: "character" },
        { at: 6200, startMs: 5800, type: "learner" },
      ]),
    ).toStrictEqual([]);
  });

  it("checks an exchange whose learner words came back only after the answer", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 6100, startMs: 6000, type: "character" },
        { at: 6500, startMs: 5000, type: "learner" },
      ]),
    ).toStrictEqual([8000]);
  });

  it("waits for the character's last words when late learner words follow a check", () => {
    expect(
      checkTimes([
        ...GREETING,
        { at: 4000, startMs: 2500, type: "learner" },
        { at: 6000, startMs: 5500, type: "character" },
        { at: 8000, startMs: 5200, type: "learner" },
        { at: 8200, startMs: 7800, type: "character" },
        { at: 8800, startMs: 8400, type: "character" },
        { at: 9200, startMs: 8800, type: "character" },
        { at: 10_000, startMs: 9600, type: "character" },
      ]),
    ).toStrictEqual([7500, 11_500]);
  });
});
