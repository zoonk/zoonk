import { randomUUID } from "node:crypto";
import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { request } from "@zoonk/e2e/fixtures";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { expect, test } from "./fixtures";

type TestSubscriptionProvider = "apple" | "google" | "stripe" | "zoonk";

type StripeSubscriptionActionPath =
  | "/api/auth/subscription/cancel"
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
 * Drive checkout through the single visible Plus action because the locale is
 * added by the client-side Better Auth call, not by the server-rendered page.
 */
async function requestPlusCheckout({ page }: { page: Page }) {
  const requestBody = captureStripeActionRequest({ page, path: "/api/auth/subscription/upgrade" });

  await page.getByRole("button", { name: /zoonk plus/iu }).click();

  return requestBody;
}

test.describe("Subscription Page - Unauthenticated", () => {
  test("shows the Plus offer and requires login before subscribing", async ({ page }) => {
    await page.goto("/subscription");

    await expect(page.getByRole("heading", { level: 1, name: /learn anything/iu })).toBeVisible();

    await expect(page.getByRole("heading", { name: /know what to learn next/iu })).toBeVisible();
    await expect(page.getByRole("heading", { name: /speak a new language/iu })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /keep learning until you get there/iu }),
    ).toBeVisible();

    const loginLink = page.getByRole("link", { name: /log in to unlock unlimited learning/iu });
    await expect(loginLink).toHaveAttribute("href", "/login?next=%2Fsubscription");
    await expect(page.getByRole("button", { name: /monthly/iu })).toBeVisible();
    await expect(page.getByRole("button", { name: /yearly/iu })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
  });
});

test.describe("Subscription Page - No Subscription", () => {
  test("shows one Plus offer with a direct subscribe action", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /learn anything/iu }),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByRole("button", { name: /unlock unlimited learning/iu }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /monthly/iu })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(authenticatedPage.getByRole("button", { name: /yearly/iu })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio")).toHaveCount(0);
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
  test("shows a direct cancellation action", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByText(/plus is active/iu)).toBeVisible();
    await expect(page.getByRole("button", { name: /cancel subscription/iu })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);

    await browserContext.close();
  });

  test("starts cancellation and shows a loading state", async ({ browser, baseURL }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    const requestBody = captureStripeActionRequest({ page, path: "/api/auth/subscription/cancel" });

    const cancelButton = page.getByRole("button", { name: /cancel subscription/iu });
    await cancelButton.click();
    await expect(cancelButton).toBeDisabled();
    await expect(requestBody).resolves.toMatchObject({ returnUrl: "/subscription" });

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
    await expect(page.getByRole("button", { name: /cancel subscription/iu })).not.toBeVisible();

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
