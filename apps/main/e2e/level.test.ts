import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { getProgressInsightDateLabel } from "../src/app/[lang]/(progress)/_components/progress-insight-date-label";
import { expect, test } from "./fixtures";

test.describe("Level Page", () => {
  test.describe("Unauthenticated Users", () => {
    test("shows login prompt with link to login page", async ({ page }) => {
      await page.goto("/level");

      await expect(page.getByText(/log in to track your progress/iu)).toBeVisible();

      await expect(page.getByRole("link", { name: /login/iu })).toHaveAttribute("href", "/login");
    });
  });

  test.describe("Authenticated Users", () => {
    test("navigates from home and sees level details with comparison", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/");

      // Wait for Progress section to load (indicates Suspense resolved)
      await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();

      // User clicks level card on home page (use flexible matcher for belt name)
      await authenticatedPage
        .getByRole("link")
        .filter({ has: authenticatedPage.getByText(/belt - level \d+/iu) })
        .click();

      await expect(authenticatedPage).toHaveURL(/\/level/u);

      await expect(
        authenticatedPage.getByRole("heading", { level: 1, name: /^level$/iu }),
      ).toBeVisible();

      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();
    });

    test("displays total BP and current belt level", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/level");

      await expect(authenticatedPage.getByText(/total brain power/iu).first()).toBeVisible();

      await expect(authenticatedPage.getByText(/bp/iu).first()).toBeVisible();

      await expect(authenticatedPage.getByText(/orange belt - level/iu)).toBeVisible();

      await expect(authenticatedPage.getByText(/bp to next level/iu)).toBeVisible();
    });

    test("displays belt progression visualization", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/level");

      await expect(authenticatedPage.getByText(/belt progression/iu)).toBeVisible();

      await expect(authenticatedPage.getByRole("progressbar")).toBeVisible();
    });

    test("keeps only the current-month Brain Power insight", async ({ baseURL, browser }) => {
      const user = await createE2EUser(baseURL!, { orgRole: "member", withProgress: true });
      const browserContext = await browser.newContext({ storageState: user.storageState });
      const page = await browserContext.newPage();

      await page.goto("/level");

      const highestBpCard = page.getByRole("article", { name: /highest bp/iu });

      const todayLabel = getProgressInsightDateLabel({ date: new Date(), locale: "en" });

      await expect(highestBpCard).toContainText(`${todayLabel} with 250 BP`);
      await expect(highestBpCard).toContainText("This month");
      await expect(page.getByRole("article", { name: /learning days/iu })).not.toBeVisible();
      await expect(page.getByRole("article", { name: /learning time/iu })).not.toBeVisible();

      await browserContext.close();
    });

    test("switching to 6 months shows different comparison text", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/level");

      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();

      await authenticatedPage.getByRole("button", { name: /6 months/iu }).click();

      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).toBeVisible();

      await expect(authenticatedPage.getByText(/vs last month/iu)).not.toBeVisible();
    });

    test("switching to year shows different comparison text", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/level");

      await authenticatedPage.getByRole("button", { name: /year/iu }).click();

      await expect(authenticatedPage.getByText(/vs last year/iu)).toBeVisible();

      await expect(authenticatedPage.getByText(/vs last month/iu)).not.toBeVisible();

      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).not.toBeVisible();
    });

    test("switching to all hides comparison text", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/level");

      // Verify we start with month comparison
      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();

      // Switch to all
      await authenticatedPage.getByRole("button", { name: /^all$/iu }).click();

      // No comparison text should be visible
      await expect(authenticatedPage.getByText(/vs last month/iu)).not.toBeVisible();
      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).not.toBeVisible();
      await expect(authenticatedPage.getByText(/vs last year/iu)).not.toBeVisible();

      // Page still shows data
      await expect(
        authenticatedPage.getByRole("heading", { level: 1, name: /^level$/iu }),
      ).toBeVisible();
    });

    test("resets offset when switching periods", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/level");

      await expect(authenticatedPage.getByText(/vs last month/iu)).toBeVisible();

      const prevButton = authenticatedPage.getByRole("button", { name: /previous period/iu });

      await prevButton.click();
      await authenticatedPage.waitForURL(/offset=1/u);

      await authenticatedPage.getByRole("button", { name: /6 months/iu }).click();

      await expect(authenticatedPage).not.toHaveURL(/offset=1/u);

      await expect(authenticatedPage.getByText(/vs last 6 months/iu)).toBeVisible();
    });

    test("displays brain power explanation sections", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/level");

      await expect(
        authenticatedPage.getByRole("heading", { name: /what is brain power/iu }),
      ).toBeVisible();

      await expect(
        authenticatedPage.getByRole("heading", { name: /how do i increase brain power/iu }),
      ).toBeVisible();

      await expect(
        authenticatedPage.getByRole("heading", { name: /why is brain power important/iu }),
      ).toBeVisible();

      await expect(authenticatedPage.getByText(/never goes down/iu)).toBeVisible();
    });
  });

  test.describe("Users Without Progress", () => {
    test("sees prompt to start learning", async ({ userWithoutProgress }) => {
      await userWithoutProgress.goto("/level");

      await expect(
        userWithoutProgress.getByText(/start learning to track your progress/iu),
      ).toBeVisible();
    });
  });
});
