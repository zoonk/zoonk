import { randomUUID } from "node:crypto";
import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

type TestSubscriptionProvider = "apple" | "google" | "stripe" | "zoonk";

type StripeSubscriptionActionPath =
  | "/api/auth/subscription/cancel"
  | "/api/auth/subscription/upgrade";

/**
 * A learner with Plus, signed in to a new browser context. Billing page tests need subscriptions
 * owned by different billing systems so we can verify the page only shows actions that actually
 * work.
 */
async function openWithSubscription(
  browser: Browser,
  options?: { cancelAt?: Date; periodEnd?: Date; provider?: TestSubscriptionProvider },
) {
  const uniqueId = randomUUID().slice(0, 8);
  const provider = options?.provider ?? "stripe";
  const user = await createE2EUser(getBaseURL());

  await prisma.subscription.create({
    data: {
      cancelAt: options?.cancelAt,
      id: randomUUID(),
      plan: "plus",
      provider,
      referenceId: user.id,
      status: "active",
      ...getProviderSubscriptionFields({ provider, uniqueId, userId: user.id }),
      ...(options?.periodEnd ? { periodEnd: options.periodEnd } : {}),
    },
  });

  const browserContext = await browser.newContext({ storageState: user.storageState });
  const page = await browserContext.newPage();

  return { browserContext, page, user };
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

/** Opens the Plus offer with the app in `locale` and returns what its checkout sends. */
async function requestCheckoutIn(
  page: Page,
  { locale, subscribeLabel }: { locale: string; subscribeLabel: string },
) {
  await setLocale(page, locale);
  await page.goto("/subscription");

  return requestPlusCheckout({ page, subscribeLabel });
}

/** The app's languages besides English, as Stripe's checkout names them. */
const STRIPE_CHECKOUTS = [
  { locale: "es", stripeLocale: "es", subscribeLabel: "Suscríbete" },
  { locale: "pt", stripeLocale: "pt-BR", subscribeLabel: "Assinar" },
  { locale: "fr", stripeLocale: "fr", subscribeLabel: "S’abonner" },
  { locale: "de", stripeLocale: "de", subscribeLabel: "Abonnieren" },
];

/**
 * A guest tried lessons without an account, so they have a session but can't subscribe yet. The
 * session cookie's cached copy still says "signed up": dropping it makes the server read the guest.
 */
async function openAsGuest(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

  const context = await browser.newContext({ storageState: user.storageState });
  await context.clearCookies({ name: /session_data/u });

  return { context, page: await context.newPage(), user };
}

test.describe("Subscription Page - Guest", () => {
  test("offers Plus for the guest's goal and asks them to sign in before subscribing", async ({
    browser,
  }) => {
    const { context, page, user } = await openAsGuest(browser);
    await goalFixture({ title: "Speak English in Toronto", userId: user.id });
    await page.goto("/subscription");

    await expect(page).toHaveURL(/\/subscription$/u);
    await expect(page.getByText("Your goal: Speak English in Toronto")).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: "Keep going with Plus." }),
    ).toBeVisible();

    // Without an account, the free plan's answer starts with trying lessons first.
    const questions = page.getByRole("region", { name: "Common questions" });
    await questions.getByText("What's in the free plan?").click();
    await expect(questions.getByText(/lessons without an account/u)).toBeVisible();

    await expect(page.getByRole("link", { name: "Get Plus" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsubscription",
    );

    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Try free" })).toHaveCount(0);

    await context.close();
  });
});

test.describe("Subscription Page - No Subscription", () => {
  test("pricing opens one Plus offer in the app, with a direct subscribe action", async ({
    userWithoutProgress: page,
  }) => {
    await page.goto("/pricing");

    await expect(page).toHaveURL(/\/subscription$/u);

    // Without a goal yet, the offer says what Zoonk gets people ready for.
    await expect(
      page.getByRole("heading", { level: 1, name: "Get ready for your exam, new job or move." }),
    ).toBeVisible();

    await expect(page.getByText(/your goal:/iu)).toHaveCount(0);
    await expect(page.getByRole("link", { exact: true, name: "Today" })).toHaveCount(0);

    await expect(
      page
        .getByRole("navigation", { name: "Settings" })
        .getByRole("link", { exact: true, name: "Home page" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Try free" })).toHaveCount(0);

    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toBeVisible();
    const questions = page.getByRole("region", { name: "Common questions" });
    await questions.getByText("What's in the free plan?").click();
    await expect(questions.getByText("With the free plan, you get:")).toBeVisible();
    await expect(questions.getByText(/without an account/u)).toHaveCount(0);

    await expect(page.getByRole("button", { name: /monthly/iu })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(page.getByRole("button", { name: /yearly/iu })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expectAccessibleScreen(page, "the Plus offer");
  });
});

const TEEN_BIRTH_YEAR = new Date().getUTCFullYear() - 15;

/**
 * A 15-year-old signed in to a new browser context, with an active guardian who hasn't approved
 * Plus yet, or with none.
 */
async function openAsTeen(browser: Browser, { withGuardian }: { withGuardian: boolean }) {
  const teen = await createE2EUser(getBaseURL());

  await Promise.all([
    learningProfileFixture({ birthMonth: 1, birthYear: TEEN_BIRTH_YEAR, userId: teen.id }),
    withGuardian &&
      guardianLinkFixture({ acceptedAt: new Date(), status: "active", userId: teen.id }),
  ]);

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
  test("a Fun learner's checkout hands Stripe the app's language", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await showInMode(page.context(), { mode: "fun", userId: noProgressUser.id });
    await page.goto("/subscription");
    await expectMode(page, "fun");
    await expectAccessibleScreen(page, "the Fun Plus offer");

    // Stripe infers English from the browser, so English sends no locale.
    const english = await requestPlusCheckout({ page, subscribeLabel: "Subscribe" });
    expect(english).not.toHaveProperty("locale");

    for (const { stripeLocale, ...checkout } of STRIPE_CHECKOUTS) {
      // oxlint-disable-next-line no-await-in-loop -- One page opens the offer in each language in turn.
      await expect(requestCheckoutIn(page, checkout)).resolves.toMatchObject({
        locale: stripeLocale,
      });
    }
  });
});

test.describe("Subscription Page - With Plus Subscription", () => {
  test("shows a Fun learner's plan instead of the offer, back from checkout: what it includes, its renewal and cancellation", async ({
    browser,
  }) => {
    const { browserContext, page, user } = await openWithSubscription(browser, {
      periodEnd: new Date("2027-03-14T12:00:00Z"),
    });

    await showInMode(browserContext, { mode: "fun", userId: user.id });

    // Back from checkout once the subscription is active, the Stripe checkout marker goes.
    await page.goto("/subscription?stripe_checkout=complete&ref=email");
    await expect(page).toHaveURL(/\/subscription\?ref=email$/u);
    await expectMode(page, "fun");

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByText("Renews on March 14, 2027.")).toBeVisible();
    await expect(page.getByText(/subscription will end on/iu)).not.toBeVisible();

    const included = page.getByRole("region", { name: "What's included" });
    await expect(included.getByText("Full exam prep, with mock exams")).toBeVisible();

    await expect(page.getByRole("heading", { name: /get ready for your exam/iu })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);
    await expectAccessibleScreen(page, "a Fun Plus plan");

    const requestBody = captureStripeActionRequest({ page, path: "/api/auth/subscription/cancel" });

    const cancelButton = page.getByRole("button", { name: /cancel subscription/iu });
    await cancelButton.click();
    await expect(cancelButton).toBeDisabled();
    await expect(requestBody).resolves.toMatchObject({ returnUrl: "/subscription" });

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
  }) => {
    const { browserContext, page } = await openWithSubscription(browser, { provider: "apple" });

    await page.goto("/subscription");

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByText(/current billing period ends on/iu)).toBeVisible();
    await expect(page.getByText(/managed through the app store/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /manage in app store/iu })).toBeVisible();
    await expect(page.getByRole("heading", { name: /get ready for your exam/iu })).toHaveCount(0);

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
  }) => {
    const { browserContext, page } = await openWithSubscription(browser, { provider: "google" });

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
  }) => {
    const { browserContext, page } = await openWithSubscription(browser, { provider: "zoonk" });

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
  test("shows cancellation notice when cancel_at is set", async ({ browser }) => {
    const cancelAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { browserContext, page } = await openWithSubscription(browser, { cancelAt });

    await page.goto("/subscription");
    await expect(page.getByText("Subscription ending", { exact: true })).toBeVisible();
    await expect(page.getByText(/subscription will end on/iu)).toBeVisible();
    await expect(page.getByRole("button", { name: /cancel subscription/iu })).not.toBeVisible();
    await expectAccessibleScreen(page, "a Plus plan that's ending");

    await browserContext.close();
  });
});
