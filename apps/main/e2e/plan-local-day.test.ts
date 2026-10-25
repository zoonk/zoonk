import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PEDRO_CLOCK_HOUR_UTC = 2.5;
const DAYS_TO_DEADLINE = 365;

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each API.
for (const difference of ["device", "learner"] as const) {
  test(`Plan hydrates with the saved learner day when the ${difference} date differs from UTC`, async ({
    browser,
  }) => {
    const now = new Date();
    // On either side of UTC's day, a real learner's date that differs from the server's at
    // every run hour. The switch at 10:00 stays clear of midnight in the selected zone.
    const oppositeZone = now.getUTCHours() < 10 ? "Etc/GMT+12" : "Pacific/Kiritimati";
    const timeZone = difference === "device" ? "America/Sao_Paulo" : oppositeZone;

    await asPersona(browser, { day: 7, persona: "stocks", timeZone }, async ({ page, user }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });

      const today = getDateInTimeZone({ date: now, timeZone: user.timeZone });
      const targetDate = new Date(today.getTime() + DAYS_TO_DEADLINE * MS_PER_DAY);

      await prisma.goal.update({ data: { targetDate }, where: { id: user.goalId } });

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const firstPhase = Array.isArray(plan.phases) ? plan.phases[0] : null;
      const phase = z.object({ endDate: z.iso.date(), startDate: z.iso.date() }).parse(firstPhase);
      const phaseStart = new Date(`${phase.startDate}T00:00:00Z`).getTime();
      const phaseEnd = new Date(`${phase.endDate}T00:00:00Z`).getTime();
      const day = Math.round((today.getTime() - phaseStart) / MS_PER_DAY) + 1;
      const days = Math.round((phaseEnd - phaseStart) / MS_PER_DAY) + 1;
      const dayText = `day ${day} of ${days}`;

      // The server keeps its real clock. Pedro's device reads 23:30 two dates earlier, so its
      // date differs from both UTC and his goal's today, including near UTC midnight.
      const clock =
        difference === "device"
          ? new Date(today.getTime() - MS_PER_DAY + PEDRO_CLOCK_HOUR_UTC * 60 * 60 * 1000)
          : now;

      expect(getDateInTimeZone({ date: clock, timeZone }).toISOString().slice(0, 10)).not.toBe(
        now.toISOString().slice(0, 10),
      );

      await page.clock.setFixedTime(clock);
      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto("/plan");

      await expect(page.getByRole("heading", { exact: true, name: "Plan" })).toBeVisible();
      // Opening the editor proves the page hydrated before inspecting the captured errors.
      await page.getByRole("button", { exact: true, name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      await expect(editor).toBeVisible();
      expect(errors.filter((message) => /#418|hydration/iu.test(message))).toEqual([]);
      const tomorrow = new Date(today.getTime() + MS_PER_DAY).toISOString().slice(0, 10);
      await expect(editor.getByLabel("Deadline", { exact: true })).toHaveAttribute("min", tomorrow);
      await editor.getByRole("button", { exact: true, name: "Close" }).click();

      await expect(page.getByRole("region", { exact: true, name: "Phases" })).toContainText(
        dayText,
      );

      await expect(page.getByRole("main")).toContainText(`${DAYS_TO_DEADLINE} days left`);

      const dateText = new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(targetDate);

      const properties = page
        .getByRole("region", { exact: true, name: "Your plan" })
        .filter({ visible: true });

      await expect(properties.getByRole("button", { name: /^Goal date/u })).toHaveText(
        `Goal date${dateText}`,
      );

      await page.screenshot({ path: test.info().outputPath(`${difference}-plan.png`) });

      await page.reload();

      await expect(page.getByRole("region", { exact: true, name: "Phases" })).toContainText(
        dayText,
      );

      expect(errors.filter((message) => /#418|hydration/iu.test(message))).toEqual([]);
    });
  });
}
