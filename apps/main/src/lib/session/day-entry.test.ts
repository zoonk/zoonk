import { describe, expect, it } from "vitest";
import { type DayEntry, findDayTap, getEntryExpiry } from "./day-entry";

const NOW = Date.parse("2026-10-15T12:00:00.000Z");
const DAY_ENDS_AT = Date.parse("2026-10-16T00:00:00.000Z");
const LOCAL_DATE = new Date("2026-10-15T00:00:00.000Z");
const HREF = "/session?goal=goal-x";

function entry(overrides: Partial<DayEntry> = {}): DayEntry {
  return {
    applied: false,
    day: {
      sessionId: null,
      shown: {
        day: {
          blocks: [
            { position: 0, status: "pending" },
            { position: 1, status: "pending" },
          ] as unknown as DayEntry["day"]["shown"]["day"]["blocks"],
          dayEndsAt: DAY_ENDS_AT,
          lessonsComing: false,
          localDate: LOCAL_DATE,
          nextPosition: 0,
          sessionBar: { completed: 0, total: 2 },
        },
        goalId: "goal-x",
        userId: "learner",
      },
    },
    expired: false,
    focusMain: true,
    generation: 3,
    href: HREF,
    id: 1,
    next: true,
    result: null,
    step: {
      blockId: null,
      position: 0,
      ref: { position: 0 } as DayEntry["step"]["ref"],
      screen: "session",
    },
    tappedAt: NOW - 500,
    ...overrides,
  };
}

const scope = { generation: 3, href: HREF, userId: "learner" };

describe(getEntryExpiry, () => {
  it("holds a tap while its POST is out, however slow, so its reply still moves the screen on", () => {
    expect(getEntryExpiry({ dayEndsAt: DAY_ENDS_AT, settledAt: null })).toBe(DAY_ENDS_AT);
  });

  it("lets a reply nothing applied go a minute after it arrived", () => {
    expect(getEntryExpiry({ dayEndsAt: DAY_ENDS_AT, settledAt: NOW })).toBe(NOW + 60_000);
  });

  it("never outlives the day it showed: yesterday's step is never drawn after midnight", () => {
    expect(getEntryExpiry({ dayEndsAt: DAY_ENDS_AT, settledAt: DAY_ENDS_AT - 1000 })).toBe(
      DAY_ENDS_AT,
    );
  });
});

describe(findDayTap, () => {
  const blocks = [
    { position: 0, status: "pending" },
    { position: 1, status: "pending" },
    { position: 2, status: "pending" },
  ];

  const day = { blocks, goalId: "goal-x", localDate: LOCAL_DATE };

  it("draws the tapped step busy from the tap, with the focus its control had", () => {
    expect(findDayTap({ ...scope, day, entry: entry() })).toStrictEqual({
      step: blocks[0],
      tap: { focus: true, state: "opening", tappedAt: NOW - 500 },
    });
  });

  it("draws the step the tap named, even when the day's next step is another", () => {
    const row = entry({ next: false, step: { ...entry().step, position: 2 } });
    expect(findDayTap({ ...scope, day, entry: row })?.step).toBe(blocks[2]);
  });

  it("stays busy once the result arrived, and while the screen applies it", () => {
    const settled = entry({ result: { kind: "refresh" } });

    expect(findDayTap({ ...scope, day, entry: settled })?.tap.state).toBe("opening");

    expect(findDayTap({ ...scope, day, entry: { ...settled, applied: true } })?.tap.state).toBe(
      "opening",
    );
  });

  it("says a failed tap failed, so the step offers Start again", () => {
    const failed = entry({ result: { kind: "failed" } });
    expect(findDayTap({ ...scope, day, entry: failed })?.tap.state).toBe("failed");
  });

  it("draws nothing with no tap, for another identity, or on another page", () => {
    expect(findDayTap({ ...scope, day, entry: null })).toBeNull();
    expect(findDayTap({ ...scope, day, entry: entry(), generation: 4 })).toBeNull();
    expect(findDayTap({ ...scope, day, entry: entry(), userId: "someone-else" })).toBeNull();

    expect(findDayTap({ ...scope, day, entry: entry(), href: "/session?goal=goal-y" })).toBeNull();
  });

  it("draws nothing once the tap expired", () => {
    expect(findDayTap({ ...scope, day, entry: entry({ expired: true }) })).toBeNull();
  });

  it("never applies to another goal's day, another day, or a step the day doesn't hold", () => {
    expect(findDayTap({ ...scope, day: { ...day, goalId: "goal-y" }, entry: entry() })).toBeNull();

    expect(
      findDayTap({
        ...scope,
        day: { ...day, localDate: new Date("2026-10-16T00:00:00.000Z") },
        entry: entry(),
      }),
    ).toBeNull();

    const elsewhere = entry({ step: { ...entry().step, position: 5 } });
    expect(findDayTap({ ...scope, day, entry: elsewhere })).toBeNull();
  });

  it("lets go of a step already done: a later screen at the same address draws its own", () => {
    const done = blocks.map((block, index) =>
      index === 0 ? { ...block, status: "completed" } : block,
    );

    expect(findDayTap({ ...scope, day: { ...day, blocks: done }, entry: entry() })).toBeNull();
  });
});
