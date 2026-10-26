import { randomUUID } from "node:crypto";
import { type Browser, type Page, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";

type StripeSubscriptionActionPath =
  | "/api/auth/subscription/cancel"
  | "/api/auth/subscription/upgrade";

/** Stripe's identifiers for a subscription, which the web's billing controls need. */
function getStripeSubscriptionFields() {
  const uniqueId = randomUUID().slice(0, 8);

  return {
    stripeCustomerId: `cus_test_e2e_${uniqueId}`,
    stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
  };
}

/** A learner with Plus through Stripe, signed in to a new browser context. */
async function openWithSubscription(browser: Browser) {
  const user = await createE2EUser(getBaseURL());

  await prisma.subscription.create({
    data: {
      id: randomUUID(),
      plan: "plus",
      provider: "stripe",
      referenceId: user.id,
      status: "active",
      ...getStripeSubscriptionFields(),
    },
  });

  const browserContext = await browser.newContext({ storageState: user.storageState });
  const page = await browserContext.newPage();

  return { browserContext, page, user };
}

/**
 * Capture the billing handoff before it reaches Stripe's fake E2E API key.
 * These tests only need the request body sent by the subscription UI, so the
 * route responds locally instead of turning them into Stripe integration tests.
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

test.describe("Subscription Page - Checkout", () => {
  test("Subscribe sends a learner on the free plan to Plus checkout, coming back to confirm it", async ({
    userWithoutProgress: page,
  }) => {
    await page.goto("/subscription");

    const checkout = captureStripeActionRequest({ page, path: "/api/auth/subscription/upgrade" });
    await page.getByRole("button", { exact: true, name: "Subscribe" }).click();

    await expect(checkout).resolves.toMatchObject({
      plan: "plus",
      successUrl: "/subscription?stripe_checkout=complete",
    });
  });
});

test.describe("Subscription Page - With Plus Subscription", () => {
  test("shows a subscriber their plan instead of the offer, and cancels it through Stripe", async ({
    browser,
  }) => {
    const { browserContext, page } = await openWithSubscription(browser);

    await page.goto("/subscription?stripe_checkout=complete&ref=email");

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);

    const requestBody = captureStripeActionRequest({ page, path: "/api/auth/subscription/cancel" });

    const cancelButton = page.getByRole("button", { name: /cancel subscription/iu });
    await cancelButton.click();
    await expect(cancelButton).toBeDisabled();
    await expect(requestBody).resolves.toMatchObject({ returnUrl: "/subscription" });

    await browserContext.close();
  });
});

/** The page back from checkout asks about the subscription this often. */
const CONFIRMATION_CHECK_MS = 3000;

/** A learner back from Stripe's checkout whose subscription the webhook hasn't saved yet. */
async function openBackFromCheckout(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

  /** Stripe's webhook lands: the subscription row the page is waiting for. */
  const confirm = () =>
    prisma.subscription.create({
      data: {
        id: randomUUID(),
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "active",
        ...getStripeSubscriptionFields(),
      },
    });

  return { confirm, context, page };
}

test.describe("Subscription Page - Back From Checkout", () => {
  test("confirms the subscription instead of showing the offer, then shows the plan", async ({
    browser,
  }) => {
    const { confirm, context, page } = await openBackFromCheckout(browser);

    // The page asks about the subscription once it's live.
    const firstAnswer = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/subscription") &&
        Boolean(response.request().headers()["next-action"]),
    );

    await page.clock.install();
    await page.goto("/subscription?stripe_checkout=complete");

    await expect(
      page.getByRole("heading", { level: 1, name: "Confirming your subscription" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);
    // Its answer coming in is the signal: Playwright doesn't always see a streamed answer finish.
    await firstAnswer;

    // Its next check is held until the webhook saved the plan, so that check reads it.
    const heldChecks: Route[] = [];

    await page.route("**/subscription?stripe_checkout=complete", async (route) => {
      if (route.request().headers()["next-action"]) {
        heldChecks.push(route);
        return;
      }

      await route.fallback();
    });

    await expect(async () => {
      if (heldChecks.length === 0) {
        await page.clock.fastForward(CONFIRMATION_CHECK_MS);
      }

      expect(heldChecks.length, "the page asks again").toBeGreaterThan(0);
    }).toPass();

    await confirm();
    await Promise.all(heldChecks.map((route) => route.continue()));

    // The plan replaces the wait once the webhook saved it.
    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await context.close();
  });
});
