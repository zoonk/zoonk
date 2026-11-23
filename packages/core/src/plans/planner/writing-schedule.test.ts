import { describe, expect, it } from "vitest";
import { listRemainingWriting, resolveWritingDay } from "./writing-schedule";

const YESTERDAY = "2026-11-21";
const TODAY = "2026-11-22";
const TOMORROW = "2026-11-23";
const answer = { minutes: 45, taskKey: "short", title: "Written answer", unit: "answer" } as const;

function attempt(completed: boolean) {
  return { completed, date: TODAY, minutes: answer.minutes, placement: false, taskKey: "short" };
}

describe("scheduled writing occurrences", () => {
  it.each([true, false])(
    "keeps the second answer after one starts (completed = %s)",
    (completed) => {
      const schedule = [{ date: TODAY, minutes: 90, tasks: [answer, answer] }];
      const input = { attempts: [attempt(completed)], schedule, today: TODAY };
      const pending = { date: TODAY, minutes: 45, test: false };

      expect.soft(resolveWritingDay(input)).toStrictEqual({ ...schedule[0], tasks: [answer] });
      expect(listRemainingWriting(input)).toStrictEqual(completed ? [pending] : [pending, pending]);
    },
  );

  it("uses a late placement answer only for the missed placement, leaving today's practice", () => {
    const schedule = [
      { date: YESTERDAY, minutes: 45, tasks: [{ ...answer, placement: true }] },
      { date: TODAY, minutes: 45, tasks: [answer] },
    ];

    const input = { attempts: [{ ...attempt(true), placement: true }], schedule, today: TODAY };

    expect(resolveWritingDay(input)).toStrictEqual(schedule[1]);
    expect(listRemainingWriting(input)).toStrictEqual([{ date: TODAY, minutes: 45, test: false }]);
  });

  it("matches a regular answer to its own day ahead of a missed earlier occurrence", () => {
    const schedule = [
      { date: YESTERDAY, minutes: 45, tasks: [answer] },
      { date: TODAY, minutes: 45, tasks: [answer] },
      { date: TOMORROW, minutes: 45, tasks: [answer] },
    ];

    const input = { attempts: [attempt(true)], schedule, today: TODAY };

    expect(resolveWritingDay(input)).toBeUndefined();

    expect(listRemainingWriting(input)).toStrictEqual([
      { date: TOMORROW, minutes: 45, test: false },
    ]);
  });
});
