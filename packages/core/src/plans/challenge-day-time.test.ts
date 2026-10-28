import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { readSelectedItemFacts } from "./_utils/selected-item-contract";
import { fromIsoDate, getPlanCalendar, toIsoDate } from "./planner/plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "./planner/plan-days";
import { parsePlanSettings } from "./planner/plan-state";

/** The time a plan's items take on a day: each lesson's portion there, or an event's whole time. */
function sumDay({
  date,
  items,
}: {
  date: string;
  items: readonly {
    facts: unknown;
    minutes: number | null;
    scheduledFor: Date | null;
    status: string;
  }[];
}): number {
  return items.reduce((total, item) => {
    const days = readSelectedItemFacts(item.facts)?.days;

    if (days) {
      return (
        total + days.filter(([day]) => day === date).reduce((sum, [, study]) => sum + study, 0)
      );
    }

    const on = item.status === "todo" && item.scheduledFor && toIsoDate(item.scheduledFor) === date;
    return total + (on ? (item.minutes ?? 0) : 0);
  }, 0);
}

// R45: a challenge counts inside its day's time. Ana's last two phase challenges share a day of
// her final stretch, whose review took the whole day beside them: the day asked 68 minutes of 45.
describe("a day that holds a challenge", () => {
  it("asks no more than its time, the time the day's challenges take past it included", async () => {
    const copyKey = randomUUID().slice(0, 8);

    const copy = await seedV2PersonaCopy({
      copyKey,
      email: `challenge-day-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    const plan = await prisma.plan.findFirstOrThrow({
      include: { goal: true, items: true },
      where: { goalId: copy.goalId },
    });

    const settings = parsePlanSettings(plan.settings);
    const calendar = getPlanCalendar({ dailyMinutes: plan.goal.dailyMinutes, settings });
    const exam = getExamDayRules({ isExam: true, settings });

    const days = [
      ...new Set(
        plan.items.flatMap((item) =>
          item.kind === "boss" && item.status === "todo" && item.scheduledFor
            ? [toIsoDate(item.scheduledFor)]
            : [],
        ),
      ),
    ];

    expect(days.length).toBeGreaterThan(0);

    const over = days.flatMap((date) => {
      const asked = sumDay({ date, items: plan.items });

      const planned = getPlannedMinutes({
        calendar,
        date: fromIsoDate(date),
        exam,
        overflow: settings.checkpointOverflow,
        targetDate: plan.goal.targetDate,
      });

      return asked > planned + 0.5 ? [{ asked, date, planned }] : [];
    });

    expect(over).toStrictEqual([]);
  });
});
