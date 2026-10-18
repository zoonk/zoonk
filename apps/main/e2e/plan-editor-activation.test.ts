import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

test("time presets move focus without saving; Enter, Space and clicks apply a single choice", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
    await page.goto("/today");
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
    await expect(selected).toHaveAttribute("aria-checked", "true");
    expect(saves).toHaveLength(0);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: before.id } }),
    ).resolves.toStrictEqual(before);

    await page.screenshot({ path: "/tmp/zoonk-review/final-walkthrough/W2/after-arrow-focus.png" });

    await page.keyboard.press("Enter");
    await expect(time.getByRole("radio", { exact: true, name: "15 min" })).toBeChecked();

    await expect
      .poll(
        async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        },
        { timeout: REPLAN_TIMEOUT_MS },
      )
      .toBe(15);

    await expect(
      editor.getByText("It's in your plan, and today's session follows it.", { exact: true }),
    ).toBeVisible();

    expect(saves).toHaveLength(1);

    await page.screenshot({
      path: "/tmp/zoonk-review/final-walkthrough/W2/after-editor-confirmation.png",
    });

    await time.getByRole("radio", { exact: true, name: "30 min" }).focus();
    await page.keyboard.press("Space");

    await expect
      .poll(
        async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        },
        { timeout: REPLAN_TIMEOUT_MS },
      )
      .toBe(30);

    expect(saves).toHaveLength(2);

    await time.getByText("1 hr", { exact: true }).click();

    await expect
      .poll(
        async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        },
        { timeout: REPLAN_TIMEOUT_MS },
      )
      .toBe(60);

    expect(saves).toHaveLength(3);
  });
});
