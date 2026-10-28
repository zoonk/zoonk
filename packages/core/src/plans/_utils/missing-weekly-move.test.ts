import { describe, expect, it } from "vitest";
import { fromIsoDate } from "../planner/plan-calendar";
import { hasWeeklyEventCollision } from "./missing-weekly-move";

/** A weekly mock the plan keeps on a day. */
function mockOn(date: string) {
  return { kind: "mock" as const, scheduledFor: fromIsoDate(date), status: "todo" as const };
}

function move(from: string, to: string) {
  return { from, kind: "moveWeeklyEvent" as const, to };
}

// Two weekly events never share a day (R43): the planner kept one and dropped the others' credits.
describe(hasWeeklyEventCollision, () => {
  it("refuses a move onto a day that holds a weekly event", () => {
    expect(
      hasWeeklyEventCollision({
        items: [mockOn("2020-10-12")],
        moves: [],
        operations: [move("2020-10-09", "2020-10-12")],
      }),
    ).toBe(true);
  });

  it("refuses two moves to one day in one change", () => {
    expect(
      hasWeeklyEventCollision({
        items: [],
        moves: [],
        operations: [move("2020-10-08", "2020-10-12"), move("2020-10-09", "2020-10-12")],
      }),
    ).toBe(true);
  });

  it("refuses a move to the day a saved move took another event to", () => {
    expect(
      hasWeeklyEventCollision({
        items: [],
        moves: [{ from: "2020-10-08", to: "2020-10-12" }],
        operations: [move("2020-10-09", "2020-10-12")],
      }),
    ).toBe(true);
  });

  it("refuses moving an event on, in one change or after a saved move", () => {
    expect(
      hasWeeklyEventCollision({
        items: [],
        moves: [],
        operations: [move("2020-10-09", "2020-10-12"), move("2020-10-12", "2020-10-13")],
      }),
    ).toBe(true);

    expect(
      hasWeeklyEventCollision({
        items: [],
        moves: [{ from: "2020-10-09", to: "2020-10-12" }],
        operations: [move("2020-10-12", "2020-10-13")],
      }),
    ).toBe(true);
  });

  it("lets a move stand, or move the same day again in place of the saved one", () => {
    const saved = { from: "2020-10-09", to: "2020-10-12" };

    expect(
      hasWeeklyEventCollision({
        items: [mockOn("2020-10-12")],
        moves: [saved],
        operations: [move("2020-10-09", "2020-10-12")],
      }),
    ).toBe(false);

    expect(
      hasWeeklyEventCollision({
        items: [mockOn("2020-10-12")],
        moves: [saved],
        operations: [move("2020-10-09", "2020-10-13")],
      }),
    ).toBe(false);
  });
});
