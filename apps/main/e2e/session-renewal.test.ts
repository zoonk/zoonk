import { type BrowserContext } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;
const SESSION_HINT_COOKIE = "zoonk-signed-in";
const RENEWAL_PATH = "/api/auth/get-session";

/** Makes the learner's session one last renewed `days` ago, as if they'd been away that long. */
async function ageSession({ days, userId }: { days: number; userId: string }) {
  const usedAt = new Date(Date.now() - days * DAY_MS);

  await prisma.session.updateMany({
    data: { expiresAt: new Date(usedAt.getTime() + SESSION_DAYS * DAY_MS), updatedAt: usedAt },
    where: { userId },
  });

  return findSession(userId);
}

function findSession(userId: string) {
  return prisma.session.findFirstOrThrow({
    select: { expiresAt: true, updatedAt: true },
    where: { userId },
  });
}

async function getCookie(context: BrowserContext, name: string) {
  const cookies = await context.cookies(getBaseURL());
  return cookies.find((cookie) => cookie.name === name || cookie.name.endsWith(name));
}

test.describe("Session renewal", () => {
  test("renews a day-old session once a day per browser with a POST, keeping the learner's hint", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    await ageSession({ days: 3, userId: user.id });

    // The browser's cached copy of the session would still show it fresh.
    const context = await browser.newContext({ storageState: user.storageState });
    await context.clearCookies({ name: /session_data/u });

    const hint = await getCookie(context, SESSION_HINT_COOKIE);
    const renewals: string[] = [];

    context.on("request", (request) => {
      if (new URL(request.url()).pathname === RENEWAL_PATH && request.method() === "POST") {
        renewals.push(request.url());
      }
    });

    const [first, second] = await Promise.all([context.newPage(), context.newPage()]);

    const renewed = context.waitForEvent("response", {
      predicate: (response) =>
        new URL(response.url()).pathname === RENEWAL_PATH && response.request().method() === "POST",
    });

    // Two tabs open at once: the browser renews once.
    await Promise.all([first.goto("/pricing"), second.goto("/courses")]);
    const renewal = await renewed;
    expect(renewal.status()).toBe(200);

    const session = await findSession(user.id);
    expect(session.updatedAt.getTime()).toBeGreaterThan(Date.now() - 5 * 60 * 1000);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + (SESSION_DAYS - 1) * DAY_MS);

    // The browser's session cookie lasts as long again, and the hint still names the same learner.
    const [sessionCookie, renewedHint] = await Promise.all([
      getCookie(context, "session_token"),
      getCookie(context, SESSION_HINT_COOKIE),
    ]);

    expect(sessionCookie?.expires).toBeGreaterThan(
      (Date.now() + (SESSION_DAYS - 1) * DAY_MS) / 1000,
    );

    expect(renewedHint?.value).toBe(hint?.value);

    // Another page of the same browser on the same day doesn't renew again. Its sidebar names the
    // learner once the page's summary is ready, which is when its renewal watch decides; any
    // renewal it started holds the browser's renewal lock until its POST is answered.
    const { name } = await prisma.user.findUniqueOrThrow({
      select: { name: true },
      where: { id: user.id },
    });

    const third = await context.newPage();
    await third.goto("/today");

    await expect(
      third.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name }),
    ).toBeVisible();

    await third.waitForFunction(async () => {
      const { held = [], pending = [] } = await navigator.locks.query();
      return [...held, ...pending].every((lock) => lock.name !== "zoonk-session-renewal");
    });

    expect(renewals).toHaveLength(1);

    await context.close();
  });

  test("pages and session reads never renew a session, however old", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const before = await ageSession({ days: 3, userId: user.id });
    const context = await browser.newContext({ storageState: user.storageState });

    // Without the cached copy, every read looks the session up.
    await context.clearCookies({ name: /session_data/u });

    // Only the renewal's POST would write; it's held back so the reads alone are measured.
    await context.route(
      (url) => url.pathname === RENEWAL_PATH,
      (route) => (route.request().method() === "POST" ? route.abort() : route.continue()),
    );

    const page = await context.newPage();
    await page.goto("/today");
    await page.goto("/courses");
    await page.waitForLoadState("networkidle");

    const read = await context.request.get(`${RENEWAL_PATH}?disableCookieCache=true`);
    await expect(read.json()).resolves.toMatchObject({ needsRefresh: true });

    await expect(findSession(user.id)).resolves.toStrictEqual(before);

    await context.close();
  });
});
