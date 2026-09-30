import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { MODES, expectMode } from "./learn-personas";
import { DAYS_TO_TEST, createClassTestDays, dayFromToday } from "./short-exam-fixtures";
import { openAs } from "./study-day";

/**
 * A class test three days away, read from the learner's slides: the plan goes day by day (the
 * exam map and gaps, practice, then the short mock the day before the test), and Today says which
 * day it is, in both modes.
 */

function weekday(date: Date): string {
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(date);
}

async function loadMockDates(planId: string): Promise<string[]> {
  const mocks = await prisma.planItem.findMany({ where: { kind: "mock", planId } });
  return mocks.map((item) => item.scheduledFor?.toISOString().slice(0, 10) ?? "");
}

test.describe("A class test days away", () => {
  for (const mode of MODES) {
    test(`plans it day by day with the short mock the day before in ${mode}`, async ({
      browser,
    }) => {
      const { plan, user } = await createClassTestDays(mode);
      const page = await openAs(browser, user);
      const mockDay = dayFromToday(DAYS_TO_TEST - 1);

      await page.goto("/today");
      await expectMode(page, mode);

      await expect(page.getByText("Day 1 of 3 · Exam map and gaps")).toBeVisible();

      await expect(page.getByText(`${weekday(mockDay)}: mock exam`)).toBeVisible();

      await expect
        .poll(async () => loadMockDates(plan.id))
        .toStrictEqual([mockDay.toISOString().slice(0, 10)]);

      await page.goto("/plan");

      await expect(
        page.getByText(`A 3-day plan with a short mock on ${weekday(mockDay)}`),
      ).toBeVisible();

      if (mode === "fun") {
        const route = page.getByRole("list", { name: "Phases of your route" });

        await expect(route.getByText("Day 1 of 3 · You are here")).toBeVisible();
        await expect(route.getByRole("heading", { name: "Exam map and gaps" })).toBeVisible();
        await expect(route.getByRole("heading", { name: "Short mock and review" })).toBeVisible();
        await expect(route.getByText(/^Boss · /u)).toHaveCount(0);
      } else {
        await expect(
          page.getByRole("heading", { name: "Day 1 of 3: Exam map and gaps" }),
        ).toBeVisible();

        await expect(page.getByText("Day 3 of 3: Short mock and review")).toBeVisible();
      }

      await page.context().close();
    });
  }

  for (const mode of MODES) {
    test(`the day before says what it holds, with a class test's own checklist, in ${mode}`, async ({
      browser,
    }) => {
      const { user } = await createClassTestDays(mode, { days: 1 });
      const page = await openAs(browser, user);

      // The plan is built when Today first opens.
      await page.goto("/today");
      await expect(page.getByText(/^Biochemistry test is tomorrow/u).first()).toBeVisible();

      await page.goto("/exam");

      const moment = page.getByRole("region", { name: "Biochemistry test is tomorrow" });
      await expect(moment.getByText(/^Today goes to the topics that come up most/u)).toBeVisible();
      await expect(moment.getByText(/light review/u)).toHaveCount(0);

      await expect(
        page.getByText("What your teacher lets you bring, like a pen or a calculator"),
      ).toBeVisible();

      await expect(page.getByText("Photo ID and your registration card")).toHaveCount(0);
      await page.context().close();
    });
  }
});
