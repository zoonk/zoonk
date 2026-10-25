import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

/**
 * Which days the learner studies is theirs to choose in "Adjust your plan": one button a day, named
 * in full and pressed while it's a study day, so a screen reader says both.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Sunday's minutes in the plan's week; null while every day keeps the daily time. */
async function loadSundayMinutes(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  const weekdayMinutes = isJsonObject(plan.settings) ? plan.settings.weekdayMinutes : null;

  return Array.isArray(weekdayMinutes) ? weekdayMinutes[0] : null;
}

test.describe("Study days", () => {
  test("names each day in full and says which ones he studies; the day he taps shows at once, his saved week again when the change doesn't save, and Sunday off once it does", async ({
    browser,
  }) => {
    // Lucas studies every day of the week, 15 minutes a day, and his small plan plans again in a
    // moment.
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const sundayBefore = await loadSundayMinutes(user.goalId);

      // While failing, every change to his week is held on its way to the server, and then never
      // reaches it.
      const held: (() => void)[] = [];
      let failing = true;

      await page.route(
        (url) => url.pathname === "/plan",
        async (route) => {
          if (
            !failing ||
            !/"set(?:Daily|Weekday)Minutes"/u.test(route.request().postData() ?? "")
          ) {
            await route.fallback();
            return;
          }

          await new Promise<void>((release) => {
            held.push(release);
          });

          await route.abort();
        },
      );

      await page.goto("/plan");
      await page.getByRole("button", { name: "Adjust plan" }).click();

      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const days = editor.getByRole("group", { name: "Study days" });
      const sunday = days.getByRole("button", { exact: true, name: "Sunday" });
      const monday = days.getByRole("button", { exact: true, name: "Monday" });
      const time = editor.getByRole("radiogroup", { name: "Time a day" });
      const failed = editor.getByRole("alert");

      await expect(days.getByRole("button")).toHaveCount(WEEKDAYS.length);

      await Promise.all(
        WEEKDAYS.map((name) =>
          expect(days.getByRole("button", { exact: true, name, pressed: true })).toBeVisible(),
        ),
      );

      // Sunday shows off as soon as he taps it, while the other days wait for the plan to save.
      await sunday.click();
      await expect.poll(() => held.length).toBe(1);
      await expect(sunday).toHaveAttribute("aria-pressed", "false");
      await expect(monday).toBeDisabled();

      held[0]?.();
      await expect(failed).toHaveText("That didn't work. Try again in a moment.");
      await expect(sunday).toHaveAttribute("aria-pressed", "true");
      await expect(monday).toBeEnabled();

      // The time he picks next shows picked while it saves, and the Sunday that didn't save
      // never shows off again meanwhile.
      await time.getByText("45 min", { exact: true }).click();
      await expect.poll(() => held.length).toBe(2);
      await expect(time.getByRole("radio", { name: /^45 min/u })).toBeChecked();
      await expect(failed).toBeHidden();
      await expect(sunday).toHaveAttribute("aria-pressed", "true");

      held[1]?.();
      await expect(failed).toBeVisible();
      await expect(time.getByRole("radio", { name: /^15 min/u })).toBeChecked();
      expect(await loadSundayMinutes(user.goalId)).toBe(sundayBefore);

      // Once it saves, Sunday is off.
      failing = false;
      await sunday.click();
      await expect(sunday).toHaveAttribute("aria-pressed", "false");

      await expect
        .poll(() => loadSundayMinutes(user.goalId), { timeout: REPLAN_TIMEOUT_MS })
        .toBe(0);
    });
  });
});
