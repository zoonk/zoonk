import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

test.describe("Content country", () => {
  test("asks which country a country-dependent goal is about, and saves the pick only on Continue", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({
      details: { answered: [], countryDependent: true, subject: "personal finance" },
      prompt: `organize my finances ${randomUUID()}`,
      title: "Organize my finances",
      userId: noProgressUser.id,
    });

    await page.goto(`/start/${goal.id}`);

    await expect(
      page.getByRole("heading", { name: "Which country should your lessons be about?" }),
    ).toBeVisible();

    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();
    await expect(page.getByText("If you skip: United States")).toBeVisible();

    const another = page.getByRole("button", { name: "Another country" });
    await expectHydrated(another);
    await another.click();

    const picker = page.getByRole("dialog", { name: "Country" });
    await picker.getByRole("combobox", { name: "Search countries" }).fill("port");
    await picker.getByRole("option", { name: "Portugal" }).click();
    await expect(picker).toBeHidden();

    const portugal = page.getByRole("radio", { name: "Portugal" });
    await expect(portugal).toBeChecked();
    await expect(portugal).toBeFocused();

    const readGoal = () => prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    await expect
      .poll(async () => {
        const unsaved = await readGoal();
        return unsaved.contentCountry;
      })
      .toBeNull();

    await continueButton.click();
    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

    const saved = await readGoal();
    expect(saved.contentCountry).toBe("PT");

    const answered = isJsonObject(saved.details) ? saved.details.answered : null;
    expect(answered).toContain("contentCountry");

    const profile = await prisma.userLearningProfile.findUnique({
      where: { userId: noProgressUser.id },
    });

    expect(profile?.homeCountry ?? null).toBeNull();
  });

  test("changes a started goal's country from the Plan after asking, and keeps the plan while the new one is prepared", async ({
    browser,
  }) => {
    // The persona's goal is in Portuguese, which names its countries; the app speaks English.
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const details = isJsonObject(goal.details) ? goal.details : {};
      const answered = Array.isArray(details.answered) ? details.answered : [];

      await prisma.goal.update({
        data: {
          contentCountry: "PT",
          details: {
            ...details,
            answered: [...answered, "contentCountry"],
            countryDependent: true,
          },
        },
        where: { id: goal.id },
      });

      const readCountry = async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.contentCountry;
      };

      await page.goto("/plan");
      const properties = page.getByRole("region", { exact: true, name: "Your plan" });
      const row = properties.getByRole("button", { name: /^Content country/u });
      await expectHydrated(row);
      await expect(row).toHaveText(/Portugal$/u);
      await expect(properties.getByText("Português (Brasil)")).toBeVisible();

      await row.click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      await editor.getByRole("button", { name: "Portugal" }).click();

      const picker = page.getByRole("dialog", { name: "Country" });
      const search = picker.getByRole("combobox", { name: "Search countries" });
      await search.fill("alem");
      await picker.getByRole("option", { name: "Alemanha" }).click();

      const confirm = page.getByRole("alertdialog", { name: "Change the content country?" });
      await expect(confirm).toContainText("New country: Alemanha.");
      await confirm.getByRole("button", { name: "Cancel" }).click();
      await expect(confirm).toBeHidden();
      await expect(picker).toBeVisible();
      expect(await readCountry()).toBe("PT");

      await picker.getByRole("option", { name: "Alemanha" }).click();
      await confirm.getByRole("button", { name: "Rebuild plan" }).click();
      await expect(picker).toBeHidden();
      await expect.poll(readCountry).toBe("DE");

      await page.keyboard.press("Escape");
      await expect(row).toHaveText(/Alemanha$/u);
      await expect(properties.getByText("Português (Brasil)")).toHaveCount(0);

      await expect(page.getByText("Preparing your new plan")).toBeVisible();
      await expect(page.locator('[data-slot="journey"]')).toBeVisible();

      // E2E has no models, so the test saves the new graph's mark as the rebuild would; the Plan
      // stays open and follows the rebuild itself, not the goal's last run.
      await prisma.followUp.update({
        data: { input: { goalId: goal.id, graphSaved: true } },
        where: {
          userKindKey: { key: goal.id, kind: "rebuildGoalCurriculum", userId: goal.userId },
        },
      });

      await expect(page.getByText("Your new plan is ready.")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Preparing your new plan")).toBeHidden();
    });
  });
});
