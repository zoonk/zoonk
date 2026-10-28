import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

async function readDailyMinutes(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.dailyMinutes;
}

test("arrow keys move through the time presets without saving, and Enter applies one", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
    await page.goto("/plan");
    await page.getByRole("button", { name: "Adjust plan" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });
    const time = editor.getByRole("radiogroup", { name: "Time a day" });
    const selected = time.getByRole("radio", { exact: true, name: "45 min" });
    await expect(selected).toBeChecked();
    const before = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
    const saves: string[] = [];

    page.on("request", (request) => {
      const body = request.postData() ?? "";

      if (request.method() === "POST" && body.includes('"setDailyMinutes"')) {
        saves.push(body);
      }
    });

    await selected.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(time.getByRole("radio", { exact: true, name: "15 min" })).toBeFocused();
    expect(saves).toHaveLength(0);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: before.id } }),
    ).resolves.toStrictEqual(before);

    await page.keyboard.press("Enter");

    await expect.poll(() => readDailyMinutes(user.goalId), { timeout: REPLAN_TIMEOUT_MS }).toBe(15);

    expect(saves).toHaveLength(1);
  });
});
