import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";

function readDailyMinutes(goalId: string) {
  return prisma.goal.findUniqueOrThrow({ where: { id: goalId } }).then((goal) => goal.dailyMinutes);
}

test("Other time a day applies a time the presets don't have, which joins them, picked", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
    await page.goto("/today");
    await page.goto("/plan");
    await page.getByRole("button", { name: "Adjust plan" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });
    const time = editor.getByRole("radiogroup", { name: "Time a day" });
    const other = editor.getByRole("combobox", { name: "Other time a day" });
    const picked = time.getByRole("radio", { name: /^1 hr 15 min/u });
    await expect(picked).toHaveCount(0);

    await other.selectOption("75");
    await expect.poll(() => readDailyMinutes(user.goalId), { timeout: REPLAN_TIMEOUT_MS }).toBe(75);

    await expect(
      editor.getByText("Daily time changed to 1 hr 15 min.", { exact: true }),
    ).toBeVisible();

    await expect(picked).toBeChecked();
    await expect(other).toHaveValue("75");

    // A preset picked next takes its place: the select goes back to asking.
    await time.getByText("45 min", { exact: true }).click();
    await expect.poll(() => readDailyMinutes(user.goalId), { timeout: REPLAN_TIMEOUT_MS }).toBe(45);
    await expect(other).toHaveValue("");
    await expect(picked).toHaveCount(0);
  });
});

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
    ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

    expect(saves).toHaveLength(1);

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

    // A pick while a save is still pending is ignored on purpose: wait for this one to settle.
    await expect(editor.getByText("Daily time changed to 30 min.", { exact: true })).toBeVisible({
      timeout: REPLAN_TIMEOUT_MS,
    });

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

    // A resized desktop page does not exercise touch's label activation.
    const phone = await browser.newContext({
      hasTouch: true,
      storageState: user.storageState,
      timezoneId: user.timeZone,
      viewport: { height: 844, width: 390 },
    });

    try {
      const phonePage = await phone.newPage();

      phonePage.on("request", (request) => {
        const body = request.postData() ?? "";

        if (request.method() === "POST" && body.includes('"setDailyMinutes"')) {
          saves.push(body);
        }
      });

      await phonePage.goto("/plan");
      await phonePage.getByRole("button", { name: "Adjust plan" }).click();
      const phoneEditor = phonePage.getByRole("dialog", { name: "Adjust your plan" });
      const phoneTime = phoneEditor.getByRole("radiogroup", { name: "Time a day" });
      await expect(phoneTime.getByRole("radio", { exact: true, name: "1 hr" })).toBeChecked();
      await phoneTime.getByText("45 min", { exact: true }).tap();
      await expect(phoneTime.getByRole("radio", { exact: true, name: "45 min" })).toBeChecked();

      await expect
        .poll(
          async () => {
            const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
            return goal.dailyMinutes;
          },
          { timeout: REPLAN_TIMEOUT_MS },
        )
        .toBe(45);

      expect(saves).toHaveLength(4);
      await phonePage.reload();
      await phonePage.getByRole("button", { name: "Adjust plan" }).click();

      await expect(phoneEditor.getByRole("radio", { exact: true, name: "45 min" })).toBeChecked();

      expect(saves).toHaveLength(4);
    } finally {
      await phone.close();
    }
  });
});

test("a time change on a plan without a date says its new end, as the Plan writes it", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "stocks" }, async ({ page }) => {
    await page.goto("/plan");
    await page.getByRole("button", { name: "Adjust plan" }).click();
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });

    await editor
      .getByRole("radiogroup", { name: "Time a day" })
      .getByText("1 hr", { exact: true })
      .click();

    // "Ends around Nov 1 instead of Nov 7.": the day the Plan shows, even within one month.
    await expect(
      editor.getByText(/^Ends around [A-Z][a-z]{2} \d{1,2} instead of [A-Z][a-z]{2} \d{1,2}\.$/u),
    ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });
  });
});
