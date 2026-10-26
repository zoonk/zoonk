import { type BrowserContext, type Page, request as apiRequest } from "@playwright/test";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "@zoonk/core/auth/ott/state";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { mockCentralSignOut } from "./auth-transport";
import { expect, test } from "./fixtures";

/** A learner with a planned goal, on it. */
async function createGoalLearner() {
  const user = await createE2EUser(getBaseURL());

  const goal = await goalFixture({
    timezone: "UTC",
    title: "Bake sourdough bread",
    userId: user.id,
  });

  await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const { name } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  return { name, user };
}

async function getUserName(user: E2EUser): Promise<string> {
  const { name } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return name;
}

async function openAs(context: BrowserContext, path: string) {
  const page = await context.newPage();
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(path);
  return page;
}

function sidebar(page: Page) {
  return page.getByRole("complementary", { name: "Sidebar" });
}

function accountRow(page: Page, name: string) {
  return sidebar(page).getByRole("button", { name: new RegExp(`^${name}`, "u") });
}

test.describe("learner summary", () => {
  test("answers a visitor without a session, never from an HTTP cache", async ({ request }) => {
    const response = await request.get("/api/learner/summary");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ status: "visitor" });
  });

  test("reloads one learner's page when another signs in in another tab", async ({ browser }) => {
    const [first, second] = await Promise.all([createGoalLearner(), createE2EUser(getBaseURL())]);
    const secondName = await getUserName(second);
    const context = await browser.newContext({ storageState: first.user.storageState });
    const page = await openAs(context, "/courses");

    await expect(accountRow(page, first.name)).toBeVisible();

    const reloaded = page.waitForEvent("load");
    await signInInAnotherTab({ context, user: second });
    await reloaded;

    await expect(accountRow(page, secondName)).toBeVisible();
    await expect(page.getByText(first.name)).toHaveCount(0);
    await expect(page.getByText("Bake sourdough bread")).toHaveCount(0);

    await context.close();
  });

  test("reloads a learner's page as a visitor's when they log out in another tab", async ({
    browser,
  }) => {
    const { name, user } = await createGoalLearner();
    const context = await browser.newContext({ storageState: user.storageState });
    const page = await openAs(context, "/plan");
    const gate = loginGate(page);

    await expect(accountRow(page, name)).toBeVisible();
    await expect(gate).toHaveCount(0);

    // Logged out in another tab, the Plan reloads and asks the visitor to log in.
    const loggedOut = page.waitForEvent("load");
    await logOutInAnotherTab(context);
    await loggedOut;
    await expect(gate).toBeVisible();

    await context.close();
  });
});

/** A gated page's way in, where its body would be. */
function loginGate(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 2, name: "Log in to continue" });
}

/** Logs the learner out from another tab's account menu, as they would. */
async function logOutInAnotherTab(context: BrowserContext) {
  const other = await context.newPage();
  await mockCentralSignOut(other);
  await other.setViewportSize({ height: 900, width: 1440 });
  await other.goto("/settings");

  await sidebar(other)
    .getByRole("button", { name: /User menu$/u })
    .click();

  await Promise.all([
    other.waitForEvent("framenavigated", { predicate: (frame) => frame === other.mainFrame() }),
    other.getByRole("menuitem", { name: "Log out" }).click(),
  ]);
}

/**
 * Signs the learner in from another tab through the auth callback, as a real sign-in ends, with a
 * token from a new session of theirs (a logout ended the one they had).
 */
async function signInInAnotherTab({ context, user }: { context: BrowserContext; user: E2EUser }) {
  const auth = await apiRequest.newContext({ baseURL: getBaseURL() });

  const signIn = await auth.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
  });

  expect(signIn.ok()).toBe(true);
  const storageState = await auth.storageState();
  await auth.dispose();

  const token = await generateOneTimeToken(getBaseURL(), { ...user, storageState });
  const state = crypto.randomUUID();

  await context.addCookies([
    { name: ONE_TIME_TOKEN_LOGIN_STATE_COOKIE, sameSite: "Lax", url: getBaseURL(), value: state },
  ]);

  const other = await context.newPage();

  await other.goto(
    `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}`,
  );

  await other.waitForURL(/\/today$/u);
}
