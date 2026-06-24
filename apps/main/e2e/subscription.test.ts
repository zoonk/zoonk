import { randomUUID } from "node:crypto";
import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { request } from "@zoonk/e2e/fixtures";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { expect, test } from "./fixtures";

type TestSubscriptionProvider = "apple" | "google" | "stripe" | "zoonk";

type StripeSubscriptionActionPath =
  | "/api/auth/subscription/billing-portal"
  | "/api/auth/subscription/upgrade";

/**
 * Billing page tests need to create subscriptions owned by different billing
 * systems so we can verify the page only shows actions that actually work.
 */
async function createUserWithSubscription(
  baseURL: string,
  plan: string,
  options?: { cancelAt?: Date; provider?: TestSubscriptionProvider },
) {
  const uniqueId = randomUUID().slice(0, 8);
  const email = `e2e-sub-${uniqueId}@zoonk.test`;
  const password = "password123";

  const signupContext = await request.newContext({ baseURL });

  const signupResponse = await signupContext.post("/api/auth/sign-up/email", {
    data: { email, name: `E2E Sub ${uniqueId}`, password },
  });

  expect(signupResponse.ok()).toBe(true);
  await signupContext.dispose();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  await prisma.subscription.create({
    data: {
      cancelAt: options?.cancelAt,
      id: randomUUID(),
      plan,
      provider: options?.provider ?? "stripe",
      referenceId: user.id,
      status: "active",
      ...getStripeSubscriptionFields({ provider: options?.provider ?? "stripe", uniqueId }),
    },
  });

  return email;
}

async function createAuthenticatedPage(browser: Browser, baseURL: string, email: string) {
  const context = await request.newContext({ baseURL });

  await context.post("/api/auth/sign-in/email", { data: { email, password: "password123" } });

  const storageState = await context.storageState();
  await context.dispose();

  const browserContext = await browser.newContext({ storageState });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

/**
 * Only Stripe-backed test subscriptions should carry Stripe identifiers.
 * Store-managed and Zoonk-managed rows need to look like non-Stripe records.
 */
function getStripeSubscriptionFields({
  provider,
  uniqueId,
}: {
  provider: TestSubscriptionProvider;
  uniqueId: string;
}) {
  if (provider !== "stripe") {
    return {};
  }

  return {
    stripeCustomerId: `cus_test_e2e_${uniqueId}`,
    stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
  };
}

/**
 * Capture the billing handoff before it reaches Stripe's fake E2E API key.
 * This test only needs the request body sent by the subscription UI, so the
 * route responds locally and avoids turning a locale assertion into a Stripe
 * integration test.
 */
async function captureStripeActionRequest({
  page,
  path,
}: {
  page: Page;
  path: StripeSubscriptionActionPath;
}) {
  await page.route(`**${path}`, async (route) => {
    await route.fulfill({
      body: JSON.stringify({ url: "/subscription" }),
      contentType: "application/json",
      status: 200,
    });
  });

  return page
    .waitForRequest(
      (actionRequest) => actionRequest.method() === "POST" && actionRequest.url().endsWith(path),
    )
    .then((actionRequest) => actionRequest.postDataJSON() as unknown);
}

/**
 * Drive checkout through the visible plan controls because the locale is added
 * by the client-side Better Auth call, not by the server-rendered plan page.
 */
async function requestPlusCheckout({ page }: { page: Page }) {
  const requestBody = captureStripeActionRequest({ page, path: "/api/auth/subscription/upgrade" });

  await page.getByRole("radio", { name: /^plus\b/iu }).click();
  await page.getByRole("button", { name: /plus/iu }).click();

  return requestBody;
}

test.describe("Subscription Page - Unauthenticated", () => {
  test("shows login prompt with link to login page", async ({ page }) => {
    await page.goto("/subscription");
    await expect(page.getByRole("alert").filter({ hasText: /logged in/iu })).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/iu });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

test.describe("Subscription Page - No Subscription", () => {
  test("displays all four plans as radio options", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /subscription/iu }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("radio", { name: /free/iu })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio", { name: /plus/iu })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio", { name: /pro/iu })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio", { name: /max/iu })).toBeVisible();
  });

  test("has Free plan selected by default when no subscription", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByRole("radio", { name: /free/iu })).toBeChecked();
    await expect(authenticatedPage.getByLabel(/current plan/iu)).toBeVisible();
  });

  test("shows monthly/yearly toggle", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByRole("tab", { name: /monthly/iu })).toBeVisible();
    await expect(authenticatedPage.getByRole("tab", { name: /yearly/iu })).toBeVisible();
  });

  test("hides action button when on free plan with free selected", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/subscription");

    await expect(authenticatedPage.getByRole("radio", { name: /free/iu })).toBeChecked();
    await expect(authenticatedPage.getByRole("button", { name: /manage/iu })).not.toBeVisible();
  });

  test("shows Upgrade button when selecting a paid plan", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await authenticatedPage.getByRole("radio", { name: /plus/iu }).click();

    await expect(
      authenticatedPage.getByRole("button", { name: /upgrade to plus/iu }),
    ).toBeVisible();
  });

  test("changes CTA label when selecting different plans", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await authenticatedPage.getByRole("radio", { name: /max/iu }).click();
    await expect(authenticatedPage.getByRole("button", { name: /upgrade to max/iu })).toBeVisible();

    await authenticatedPage.getByRole("radio", { name: /free/iu }).click();

    await expect(
      authenticatedPage.getByRole("button", { name: /upgrade to max/iu }),
    ).not.toBeVisible();
  });
});

test.describe("Subscription Page - Stripe Locale", () => {
  test("passes Spanish locale to Stripe checkout", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "es");
    await authenticatedPage.goto("/subscription");

    await expect(requestPlusCheckout({ page: authenticatedPage })).resolves.toMatchObject({
      locale: "es",
    });
  });

  test("passes Portuguese locale as Brazilian Portuguese to Stripe checkout", async ({
    authenticatedPage,
  }) => {
    await setLocale(authenticatedPage, "pt");
    await authenticatedPage.goto("/subscription");

    await expect(requestPlusCheckout({ page: authenticatedPage })).resolves.toMatchObject({
      locale: "pt-BR",
    });
  });

  test("passes French locale to Stripe checkout", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "fr");
    await authenticatedPage.goto("/subscription");

    await expect(requestPlusCheckout({ page: authenticatedPage })).resolves.toMatchObject({
      locale: "fr",
    });
  });

  test("passes German locale to Stripe checkout", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "de");
    await authenticatedPage.goto("/subscription");

    await expect(requestPlusCheckout({ page: authenticatedPage })).resolves.toMatchObject({
      locale: "de",
    });
  });

  test("keeps English Stripe checkout locale unset", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "en");
    await authenticatedPage.goto("/subscription");

    const requestBody = await requestPlusCheckout({ page: authenticatedPage });

    expect(requestBody).not.toHaveProperty("locale");
  });
});

test.describe("Subscription Page - With Plus Subscription", () => {
  test("has current plan selected by default and shows Current badge", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByRole("radio", { name: /plus/iu })).toBeChecked();
    await expect(page.getByLabel(/current plan/iu)).toBeVisible();
    await expect(page.getByRole("button", { name: /manage/iu })).toBeVisible();

    await browserContext.close();
  });

  test("shows Upgrade when selecting a higher plan", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await page.getByRole("radio", { name: /pro/iu }).click();
    await expect(page.getByRole("button", { name: /upgrade to pro/iu })).toBeVisible();

    await browserContext.close();
  });

  test("shows Cancel when selecting Free plan", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await page.getByRole("radio", { name: /free/iu }).click();
    await expect(page.getByRole("button", { name: /cancel/iu })).toBeVisible();

    await browserContext.close();
  });

  test("CTA button shows loading state when clicked", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    const manageButton = page.getByRole("button", { name: /manage/iu });
    await manageButton.click();
    await expect(manageButton).toBeDisabled();

    await browserContext.close();
  });
});

test.describe("Subscription Page - With Max Subscription", () => {
  test("shows Switch to for lower paid plans and Cancel for Free", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "max");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByRole("radio", { name: /max/iu })).toBeChecked();
    await expect(page.getByLabel(/current plan/iu)).toBeVisible();

    await page.getByRole("radio", { name: /plus/iu }).click();
    await expect(page.getByRole("button", { name: /switch to plus/iu })).toBeVisible();

    await page.getByRole("radio", { name: /free/iu }).click();
    await expect(page.getByRole("button", { name: /cancel/iu })).toBeVisible();

    await browserContext.close();
  });
});

test.describe("Subscription Page - Provider Managed", () => {
  test("Apple subscriptions direct users to App Store support instead of Stripe controls", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "plus", { provider: "apple" });
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByText(/managed through the app store/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /manage in app store/iu })).toBeVisible();

    await expect(page.getByRole("link", { name: /manage in app store/iu })).toHaveAttribute(
      "href",
      "https://support.apple.com/billing",
    );

    await expect(page.getByRole("link", { name: /contact support/iu })).toHaveAttribute(
      "href",
      "/support",
    );

    await expect(page.getByRole("radio", { name: /free/iu })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /manage/iu })).not.toBeVisible();

    await browserContext.close();
  });

  test("Zoonk-managed subscriptions send users to support instead of plan controls", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "plus", { provider: "zoonk" });
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByText(/managed by zoonk/iu)).toBeVisible();

    await expect(page.getByRole("link", { name: /contact support/iu })).toHaveAttribute(
      "href",
      "/support",
    );

    await expect(page.getByRole("radio", { name: /free/iu })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /manage/iu })).not.toBeVisible();

    await browserContext.close();
  });
});

test.describe("Subscription Page - With Cancelled Subscription", () => {
  test("shows cancellation notice when cancel_at is set", async ({ browser, baseURL }) => {
    const cancelAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const email = await createUserWithSubscription(baseURL!, "plus", { cancelAt });
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");
    await expect(page.getByText(/subscription will end on/iu)).toBeVisible();

    await browserContext.close();
  });

  test("does not show cancellation notice when cancel_at is null", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");
    await expect(page.getByText(/subscription will end on/iu)).not.toBeVisible();

    await browserContext.close();
  });
});
