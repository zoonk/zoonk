import { describe, expect, it } from "vitest";
import { type DayEntry, findDayTap, getEntryExpiry, hasLeftEntry } from "./day-entry";

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
    here: async () => true,
    href: HREF,
    id: 1,
    next: true,
    result: null,
    shown: false,
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

const scope = { href: HREF, learner: "learner" };

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

  it("draws nothing with no tap, for another identity, once signed out, or on another page", () => {
    expect(findDayTap({ ...scope, day, entry: null })).toBeNull();
    expect(findDayTap({ ...scope, day, entry: entry(), learner: null })).toBeNull();
    expect(findDayTap({ ...scope, day, entry: entry(), learner: "someone-else" })).toBeNull();

    expect(findDayTap({ ...scope, day, entry: entry(), href: "/session?goal=goal-y" })).toBeNull();
  });

  it("draws a tap for the learner its day was drawn for while the browser knows no one yet", () => {
    expect(findDayTap({ ...scope, day, entry: entry(), learner: undefined })?.step).toBe(blocks[0]);
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

describe(hasLeftEntry, () => {
  const TODAY = "/today";
  const tapped = { at: HREF, entry: entry(), origin: TODAY };

  it("keeps a tap while the learner is on its screen, or still on their way there", () => {
    expect(hasLeftEntry(tapped)).toBe(false);
    expect(hasLeftEntry({ ...tapped, at: TODAY })).toBe(false);
    expect(hasLeftEntry({ ...tapped, entry: entry({ shown: true }) })).toBe(false);
  });

  it("lets go once they're back where they tapped after the step showed", () => {
    expect(hasLeftEntry({ ...tapped, at: TODAY, entry: entry({ shown: true }) })).toBe(true);
  });

  it("lets go once they're anywhere else", () => {
    expect(hasLeftEntry({ ...tapped, at: "/plan" })).toBe(true);
  });
});
