import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

async function readDailyMinutes(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.dailyMinutes;
}

test("keys move through the daily times without saving, and Enter applies one", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
    await page.goto("/plan");
    await page.getByRole("button", { name: "Adjust plan" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });
    const time = editor.getByLabel("Time a day", { exact: true });
    await expect(time).toHaveValue("45");
    const before = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
    const saves: string[] = [];

    page.on("request", (request) => {
      const body = request.postData() ?? "";

      if (request.method() === "POST" && body.includes('"setDailyMinutes"')) {
        saves.push(body);
      }
    });

    // Typing a time's first digit moves a closed select on every platform; arrows only on some.
    await time.focus();
    await page.keyboard.press("1");
    await expect(time).toHaveValue("60");
    expect(saves).toHaveLength(0);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: before.id } }),
    ).resolves.toStrictEqual(before);

    await page.keyboard.press("Enter");

    await expect.poll(() => readDailyMinutes(user.goalId), { timeout: REPLAN_TIMEOUT_MS }).toBe(60);

    expect(saves).toHaveLength(1);
  });
});
