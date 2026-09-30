import { randomUUID } from "node:crypto";
import { type Browser, type Page } from "@playwright/test";
import { getFreePlanLimits, getPlusPlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { prisma } from "@zoonk/db";
import { request } from "@zoonk/e2e/fixtures";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

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
  options?: { cancelAt?: Date; periodEnd?: Date; provider?: TestSubscriptionProvider },
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
      ...getProviderSubscriptionFields({
        provider: options?.provider ?? "stripe",
        uniqueId,
        userId: user.id,
      }),
      ...(options?.periodEnd ? { periodEnd: options.periodEnd } : {}),
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

/** Apple access is period-bounded, while Stripe fixtures need provider identifiers for web billing controls. */
function getProviderSubscriptionFields({
  provider,
  uniqueId,
  userId,
}: {
  provider: TestSubscriptionProvider;
  uniqueId: string;
  userId: string;
}) {
  if (provider === "apple") {
    return {
      billingInterval: "month",
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      periodStart: new Date(),
      providerProductId: "com.zoonk.plus.monthly",
      providerSubscriptionId: `apple_test_e2e_${uniqueId}`,
      userId,
    };
  }

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
async function requestPlusCheckout({
  page,
  subscribeLabel,
}: {
  page: Page;
  subscribeLabel: string;
}) {
  const requestBody = captureStripeActionRequest({ page, path: "/api/auth/subscription/upgrade" });

  await page.getByRole("button", { exact: true, name: subscribeLabel }).click();

  return requestBody;
}

/**
 * A guest tried lessons without an account, so they have a session but can't subscribe yet. The
 * session cookie's cached copy still says "signed up": dropping it makes the server read the guest.
 */
async function openAsGuest(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

  const context = await browser.newContext({ storageState: user.storageState });
  await context.clearCookies({ name: /session_data/u });

  return { context, page: await context.newPage() };
}

test.describe("Subscription Page - Guest", () => {
  test("shows the Plus offer and asks the guest to log in before subscribing", async ({
    browser,
  }) => {
    const limits = getFreePlanLimits();
    const { context, page } = await openAsGuest(browser);
    await page.goto("/subscription");

    await expect(page).toHaveURL(/\/subscription$/u);
    await expect(page.getByRole("heading", { level: 1, name: /learn anything/iu })).toBeVisible();

    await expect(
      page.getByText(`No account yet? You can try ${limits.guestLessons} lessons first.`),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /log in to subscribe/iu })).toHaveAttribute(
      "href",
      "/login?next=%2Fsubscription",
    );

    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Try free" })).toHaveCount(0);

    await context.close();
  });
});

test.describe("Subscription Page - No Subscription", () => {
  test("shows one Plus offer with a direct subscribe action", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/subscription");

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: /learn anything/iu }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /^subscribe$/iu })).toBeVisible();
    await expect(authenticatedPage.getByText(/no account yet/iu)).toHaveCount(0);

    await expect(authenticatedPage.getByRole("button", { name: /monthly/iu })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(authenticatedPage.getByRole("button", { name: /yearly/iu })).toBeVisible();
    await expect(authenticatedPage.getByRole("radio")).toHaveCount(0);
  });
});

/** A teen (the minor persona, whose guardian hasn't approved Plus) signed in to a new browser context. */
async function openAsTeen(browser: Browser, { withGuardian }: { withGuardian: boolean }) {
  const teen = await createE2EPersona(getBaseURL(), { persona: "minor" });

  if (!withGuardian) {
    await prisma.guardianLink.deleteMany({ where: { userId: teen.id } });
  }

  const context = await browser.newContext({ storageState: teen.storageState });
  return { context, page: await context.newPage() };
}

test.describe("Subscription Page - Learner under 18", () => {
  test("asks the guardian to approve Plus instead of a checkout that can't work", async ({
    browser,
  }) => {
    const { context, page } = await openAsTeen(browser, { withGuardian: true });
    await page.goto("/subscription");

    await expect(
      page.getByText("You're under 18, so a guardian approves Plus before you subscribe."),
    ).toBeVisible();

    await expect(page.getByRole("button", { exact: true, name: "Subscribe" })).toHaveCount(0);

    await page.getByRole("button", { name: "Ask my guardian" }).click();

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "We emailed your guardian. Once they approve, come back here" }),
    ).toBeVisible();

    await context.close();
  });

  test("without a guardian, points to the invite first", async ({ browser }) => {
    const { context, page } = await openAsTeen(browser, { withGuardian: false });
    await page.goto("/subscription");

    await page.getByRole("button", { name: "Ask my guardian" }).click();

    await expect(page.getByRole("link", { name: "Invite a guardian" })).toHaveAttribute(
      "href",
      "/settings/guardian",
    );

    await context.close();
  });
});

test.describe("Subscription Page - Stripe Locale", () => {
  test("passes Spanish locale to Stripe checkout", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "es");
    await authenticatedPage.goto("/subscription");

    await expect(
      requestPlusCheckout({ page: authenticatedPage, subscribeLabel: "Suscríbete" }),
    ).resolves.toMatchObject({ locale: "es" });
  });

  test("passes Portuguese locale as Brazilian Portuguese to Stripe checkout", async ({
    authenticatedPage,
  }) => {
    await setLocale(authenticatedPage, "pt");
    await authenticatedPage.goto("/subscription");

    await expect(
      requestPlusCheckout({ page: authenticatedPage, subscribeLabel: "Assinar" }),
    ).resolves.toMatchObject({ locale: "pt-BR" });
  });

  test("passes French locale to Stripe checkout", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "fr");
    await authenticatedPage.goto("/subscription");

    await expect(
      requestPlusCheckout({ page: authenticatedPage, subscribeLabel: "S’abonner" }),
    ).resolves.toMatchObject({ locale: "fr" });
  });

  test("passes German locale to Stripe checkout", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "de");
    await authenticatedPage.goto("/subscription");

    await expect(
      requestPlusCheckout({ page: authenticatedPage, subscribeLabel: "Abonnieren" }),
    ).resolves.toMatchObject({ locale: "de" });
  });

  test("keeps English Stripe checkout locale unset", async ({ authenticatedPage }) => {
    await setLocale(authenticatedPage, "en");
    await authenticatedPage.goto("/subscription");

    const requestBody = await requestPlusCheckout({
      page: authenticatedPage,
      subscribeLabel: "Subscribe",
    });

    expect(requestBody).not.toHaveProperty("locale");
  });
});

test.describe("Subscription Page - With Plus Subscription", () => {
  test("shows the plan instead of the offer: what it includes, its renewal and cancellation", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "plus", {
      periodEnd: new Date("2027-03-14T12:00:00Z"),
    });

    const [{ browserContext, page }, user] = await Promise.all([
      createAuthenticatedPage(browser, baseURL!, email),
      prisma.user.findUniqueOrThrow({ where: { email } }),
    ]);

    await showInMode(browserContext, { mode: "fun", userId: user.id });
    await page.goto("/subscription");
    await expectMode(page, "fun");

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText("Renews on March 14, 2027.")).toBeVisible();

    const included = page.getByRole("region", { name: "What's included" });
    await expect(included.getByText("Exam prep")).toBeVisible();
    await expect(included.getByText("Everything, including mock exams")).toBeVisible();
    await expect(included.getByText("Unlimited*")).toHaveCount(3);

    await expect(
      included.getByText(
        `With Plus, you can start up to ${getPlusPlanLimits().newGoalsPerDay} new goals a day.`,
      ),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: /learn anything/iu })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /cancel subscription/iu })).toBeVisible();

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

  test("clears the Stripe checkout marker once the subscription is active", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "plus");
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription?stripe_checkout=complete&ref=email");

    await expect(page).toHaveURL(/\/subscription\?ref=email$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();

    await browserContext.close();
  });
});

/** A learner back from Stripe's checkout whose subscription the webhook hasn't saved yet. */
async function openBackFromCheckout(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();
  const uniqueId = randomUUID().slice(0, 8);

  /** Stripe's webhook lands: the subscription row the page is waiting for. */
  const confirm = () =>
    prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "active",
        ...getProviderSubscriptionFields({ provider: "stripe", uniqueId, userId: user.id }),
      },
    });

  return { confirm, context, page };
}

test.describe("Subscription Page - Back From Checkout", () => {
  test("confirms the subscription instead of showing the offer, then shows the plan", async ({
    browser,
  }) => {
    const { confirm, context, page } = await openBackFromCheckout(browser);
    await page.goto("/subscription?stripe_checkout=complete");

    await expect(
      page.getByRole("heading", { level: 1, name: "Confirming your subscription" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);

    await confirm();

    // No refresh: the plan replaces the wait once the webhook saved it.
    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page).toHaveURL(/\/subscription$/u);
    await context.close();
  });

  test("says it's still confirming after a while, and checks again on a tap", async ({
    browser,
  }) => {
    const { confirm, context, page } = await openBackFromCheckout(browser);
    await page.clock.install();

    // The page asks again (a refresh, not a prefetch) once it's live: only then time can jump.
    const firstCheck = page.waitForRequest((check) => {
      const headers = check.headers();
      const { pathname } = new URL(check.url());

      return (
        pathname.endsWith("/subscription") &&
        headers.rsc === "1" &&
        !headers["next-router-prefetch"]
      );
    });

    await page.goto("/subscription?stripe_checkout=complete");
    await firstCheck;

    await expect(
      page.getByRole("heading", { level: 1, name: "Confirming your subscription" }),
    ).toBeVisible();

    await page.clock.fastForward(60_000);

    await expect(
      page.getByRole("heading", { level: 1, name: "Still confirming your subscription" }),
    ).toBeVisible();

    await confirm();
    await page.getByRole("button", { name: "Check again" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await context.close();
  });
});

test.describe("Subscription Page - Provider Managed", () => {
  test("Apple subscriptions direct users to App Store settings instead of Stripe controls", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "plus", { provider: "apple" });
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByText(/current billing period ends on/iu)).toBeVisible();
    await expect(page.getByText(/managed through the app store/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /manage in app store/iu })).toBeVisible();
    await expect(page.getByRole("heading", { name: /learn anything/iu })).toHaveCount(0);

    await expect(page.getByRole("link", { name: /manage in app store/iu })).toHaveAttribute(
      "href",
      "https://apps.apple.com/account/subscriptions",
    );

    await expect(page.getByRole("link", { name: /contact support/iu })).toHaveAttribute(
      "href",
      "/support",
    );

    await expect(page.getByRole("button", { name: /cancel subscription/iu })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).not.toBeVisible();

    await browserContext.close();
  });

  test("Google subscriptions direct users to Google Play instead of Stripe controls", async ({
    browser,
    baseURL,
  }) => {
    const email = await createUserWithSubscription(baseURL!, "plus", { provider: "google" });
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    await page.goto("/subscription");

    await expect(page.getByText(/managed through google play/iu)).toBeVisible();

    await expect(page.getByRole("link", { name: /manage in google play/iu })).toHaveAttribute(
      "href",
      "https://play.google.com/store/account/subscriptions",
    );

    await expect(page.getByRole("link", { name: /contact support/iu })).toHaveAttribute(
      "href",
      "/support",
    );

    await expect(page.getByRole("button", { name: /cancel subscription/iu })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).not.toBeVisible();

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
    await expect(page.getByText("Subscription ending", { exact: true })).toBeVisible();
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
