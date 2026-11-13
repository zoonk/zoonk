import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { openAs } from "./study-day";

function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} min`;
  }

  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

async function openJourney(page: Page) {
  await page.goto("/plan");
  await expect(page.locator('[data-slot="journey"]')).toBeVisible();
}

test.describe("Journey", () => {
  test("says what a time change in the plan editor did, and Undo gives the plan back as it was", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const loadPlanItems = async () => {
        const items = await prisma.planItem.findMany({
          select: { kind: true, lessonId: true, scheduledFor: true, skillId: true, status: true },
          where: { plan: { goalId: user.goalId } },
        });

        return items
          .map(
            (item) =>
              `${item.kind}:${item.lessonId ?? item.skillId}:${item.scheduledFor?.toISOString() ?? "-"}:${item.status}`,
          )
          .toSorted();
      };

      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const otherTime = goal.dailyMinutes === 15 ? 30 : 15;

      await openJourney(page);
      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByLabel("Time a day", { exact: true });
      const before = await loadPlanItems();

      await minutes.selectOption(String(otherTime));

      await expect(
        editor
          .getByRole("status")
          .filter({ hasText: `You now study ${minutesLabel(otherTime)} a day.` }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await expect.poll(loadPlanItems).not.toStrictEqual(before);
      await editor.getByRole("button", { name: "Undo" }).click();

      await expect(
        editor.getByRole("status").filter({ hasText: "Undone. Your plan is back as it was." }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await expect(minutes).toHaveValue(String(goal.dailyMinutes));
      await expect(editor.getByRole("button", { name: "Undo" })).toHaveCount(0);
      await expect.poll(loadPlanItems).toStrictEqual(before);

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ).resolves.toMatchObject({ dailyMinutes: goal.dailyMinutes });
    });
  });

  test("saves a language goal's country from the plan's Language row, and takes it back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const readCountry = async () => {
        const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
        return goal.targetRegion;
      };

      await openJourney(page);
      const properties = page.getByRole("region", { exact: true, name: "Your plan" });
      const row = properties.getByRole("button", { name: /^Language/u });
      await expectHydrated(row);
      await expect(row).toHaveText(/English$/u);
      await row.click();

      const country = page
        .getByRole("dialog", { name: "Adjust your plan" })
        .getByLabel("Country", { exact: true });

      await expect(country).toBeFocused();
      await country.selectOption("CA");
      await expect.poll(readCountry).toBe("CA");

      await page.keyboard.press("Escape");
      await expect(row).toHaveText(/English \(Canada\)$/u);

      await expect(
        page.getByRole("button", { name: /English \(Canada\).*Switch goal$/u }),
      ).toBeVisible();

      await row.click();
      await country.selectOption("");
      await expect.poll(readCountry).toBeNull();

      await page.keyboard.press("Escape");
      await expect(row).toHaveText(/English$/u);
    });
  });

  test("pauses and resumes a goal that still has setup questions left", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());

    const goal = await goalFixture({
      details: { answered: [] },
      planRevealedAt: null,
      title: "Astronomy",
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    const page = await openAs(browser, user);

    const readStatus = async () => {
      const { status } = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      return status;
    };

    await page.goto("/plan");
    await expect(page.getByRole("link", { name: "Continue" })).toBeVisible();

    const options = page.getByRole("button", { name: "Plan options" });
    await expectHydrated(options);
    await options.click();
    await page.getByRole("menuitem", { name: "Pause this goal" }).click();

    await expect(
      page.getByRole("heading", { name: "Your Astronomy goal is paused" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Continue" })).toHaveCount(0);
    await expect.poll(readStatus).toBe("paused");

    await page.getByRole("button", { name: "Resume" }).click();

    await expect(page.getByRole("link", { name: "Continue" })).toBeVisible();
    await expect.poll(readStatus).toBe("active");

    await page.context().close();
  });
});
