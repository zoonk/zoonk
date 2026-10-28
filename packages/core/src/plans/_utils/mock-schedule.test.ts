import { describe, expect, it } from "vitest";
import { getMockSchedule } from "./mock-schedule";

const TODAY = new Date("2026-10-12T00:00:00Z");

function mock(date: string, status: "done" | "skipped" | "todo" = "todo") {
  return { kind: "mock" as const, scheduledFor: new Date(`${date}T00:00:00Z`), status };
}

describe(getMockSchedule, () => {
  it("is null without a mock ahead: none, or only taken and missed ones", () => {
    expect(getMockSchedule({ items: [], today: TODAY })).toBeNull();

    expect(
      getMockSchedule({
        items: [
          mock("2026-10-04"),
          mock("2026-10-18", "done"),
          { kind: "lesson", scheduledFor: new Date("2026-10-19T00:00:00Z"), status: "todo" },
        ],
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("says the weekday and the weeks between mocks that keep both", () => {
    expect(
      getMockSchedule({
        items: [mock("2026-11-01"), mock("2026-10-18"), mock("2026-11-15")],
        today: TODAY,
      }),
    ).toStrictEqual({ count: 3, everyWeeks: 2, nextDate: "2026-10-18", weekday: 0 });
  });

  it("keeps the weekday alone when the weeks between mocks change", () => {
    expect(
      getMockSchedule({
        items: [mock("2026-10-18"), mock("2026-11-08"), mock("2026-11-15"), mock("2026-11-22")],
        today: TODAY,
      }),
    ).toStrictEqual({ count: 4, everyWeeks: null, nextDate: "2026-10-18", weekday: 0 });
  });

  it("claims no weekday when a phase's own mock falls on another day", () => {
    expect(
      getMockSchedule({
        items: [mock("2026-10-18"), mock("2026-11-01"), mock("2026-11-13")],
        today: TODAY,
      }),
    ).toStrictEqual({ count: 3, everyWeeks: null, nextDate: "2026-10-18", weekday: null });
  });

  it("claims no pattern from one mock, and counts each day once", () => {
    expect(
      getMockSchedule({ items: [mock("2026-10-18"), mock("2026-10-18")], today: TODAY }),
    ).toStrictEqual({ count: 1, everyWeeks: null, nextDate: "2026-10-18", weekday: null });
  });

  it("counts today's mock as ahead", () => {
    expect(getMockSchedule({ items: [mock("2026-10-12")], today: TODAY })).toMatchObject({
      nextDate: "2026-10-12",
    });
  });
});
