import { describe, expect, it } from "vitest";
import { getReminderWindow } from "./_utils/reminder-window";
import { pickReminderMessage } from "./reminder-message";

const MS_PER_DAY = 86_400_000;
const MONDAY = new Date("2026-10-05T00:00:00Z");

function goal(overrides: Partial<Parameters<typeof pickReminderMessage>[0]["goals"][0]> = {}) {
  return {
    goalId: "goal-1",
    isExam: false,
    minutesDone: 0,
    minutesLeft: 20,
    title: "Italian",
    ...overrides,
  };
}

describe(pickReminderMessage, () => {
  it("names the first goal and picks the situation", () => {
    expect(pickReminderMessage({ goals: [goal()], localDate: MONDAY }).situation).toBe("oneGoal");

    expect(
      pickReminderMessage({ goals: [goal(), goal({ goalId: "goal-2" })], localDate: MONDAY }),
    ).toMatchObject({ goalId: "goal-1", otherGoals: 1, situation: "severalGoals" });

    expect(
      pickReminderMessage({ goals: [goal({ minutesDone: 10 })], localDate: MONDAY }).situation,
    ).toBe("partlyDone");

    expect(
      pickReminderMessage({ goals: [goal({ isExam: true, minutesDone: 5 })], localDate: MONDAY })
        .situation,
    ).toBe("exam");
  });

  it("doesn't repeat a title within a week", () => {
    const titles = Array.from(
      { length: 7 },
      (_, day) =>
        pickReminderMessage({
          goals: [goal()],
          localDate: new Date(MONDAY.getTime() + day * MS_PER_DAY),
        }).titleVariant,
    );

    expect(new Set(titles).size).toBe(7);
  });
});

function atHalfPastEleven(iso: string) {
  return getReminderWindow({ now: new Date(iso), time: "23:30", timeZone: "UTC" });
}

describe(getReminderWindow, () => {
  it("opens at the reminder's time for an hour, in the zone's local day", () => {
    const window = getReminderWindow({
      now: new Date("2026-10-07T22:30:00Z"),
      time: "19:15",
      timeZone: "America/Sao_Paulo",
    });

    expect(window).toStrictEqual({
      endsAt: new Date("2026-10-07T23:15:00Z"),
      localDate: new Date("2026-10-07T00:00:00Z"),
      open: true,
    });
  });

  it("never runs past local midnight", () => {
    expect(atHalfPastEleven("2026-10-07T23:45:00Z")).toMatchObject({
      endsAt: new Date("2026-10-08T00:00:00Z"),
      open: true,
    });

    expect(atHalfPastEleven("2026-10-08T00:10:00Z").open).toBe(false);
  });
});
