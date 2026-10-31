import { randomUUID } from "node:crypto";
import { type Browser, type Page, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";

type StripeSubscriptionActionPath = "/api/auth/subscription/upgrade";

function getStripeSubscriptionFields() {
  const uniqueId = randomUUID().slice(0, 8);

  return {
    stripeCustomerId: `cus_test_e2e_${uniqueId}`,
    stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
  };
}

async function openWithSubscription(browser: Browser) {
  const user = await createE2EUser(getBaseURL());

  await prisma.subscription.create({
    data: {
      id: randomUUID(),
      periodEnd: new Date(Date.now() + 86_400_000),
      periodStart: new Date(Date.now() - 30 * 86_400_000),
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
  test("shows a subscriber their plan instead of the offer, and cancels it in the app", async ({
    browser,
  }) => {
    const { browserContext, page, user } = await openWithSubscription(browser);

    await page.goto("/settings");

    await page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: /^Subscription/u })
      .click();

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);

    await page.getByRole("link", { exact: true, name: "Cancel subscription" }).click();
    await expect(page).toHaveURL(/\/subscription\/cancel$/u);
    await page.getByRole("button", { exact: true, name: "Cancel now" }).click();
    await expect(page.getByRole("status")).toContainText("You keep Plus until");

    await expect
      .poll(async () => prisma.subscription.findFirst({ where: { referenceId: user.id } }))
      .toMatchObject({ cancelAtPeriodEnd: true, status: "active" });

    await browserContext.close();
  });
});

const CONFIRMATION_CHECK_MS = 3000;

async function openBackFromCheckout(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

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

    await expect(page.getByRole("heading", { level: 1, name: "Plus" })).toBeVisible();
    await context.close();
  });
});
