import { createHmac } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/** Core signs links with this key wherever no secret is set, these servers included. */
const LOCAL_UNSUBSCRIBE_SECRET = "zoonk-local-study-reminder-unsubscribe";

function signUnsubscribeToken(userId: string): string {
  const signature = createHmac("sha256", LOCAL_UNSUBSCRIBE_SECRET)
    .update(`study-reminder-email-unsubscribe:${userId}`)
    .digest("base64url");

  return `${userId}.${signature}`;
}

function readReminder(userId: string) {
  return prisma.studyReminder.findUnique({
    select: { emailOn: true, offeredAt: true, time: true },
    where: { userId },
  });
}

test.describe("Study reminders", () => {
  test("turns email reminders on from the offer under a finished plan lesson", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ reviewDone: true });
    const page = await openAs(browser, user);
    await page.goto("/today");

    const start = page.getByRole("button", { name: /^(?:Start|Continue)/u });
    await expectHydrated(start);
    await start.press("Enter");

    await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
    await page.keyboard.press("2");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Lesson complete" })).toBeVisible();

    const offer = page.getByRole("region", { name: "Want a study reminder?" });

    await offer.getByLabel("Reminder time").selectOption("20:30");
    await expect(offer).toContainText(`We'll email ${user.email} at 8:30 PM`);
    await offer.getByRole("button", { name: "Remind me" }).click();
    await expect(offer.getByText("Email reminders are on.")).toBeVisible();

    await expect
      .poll(() => readReminder(user.id))
      .toMatchObject({ emailOn: true, offeredAt: expect.any(Date), time: "20:30" });

    await page.context().close();
  });

  test("turns email reminders on and moves their time in Settings", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const page = await openAs(browser, user);
    await page.goto("/settings/reminders");

    const email = page.getByRole("switch", { name: "Email" });
    await expectHydrated(email);
    await email.click();
    await expect(email).toBeChecked();
    await expect.poll(() => readReminder(user.id)).toMatchObject({ emailOn: true });

    await page.getByLabel("Time").selectOption("07:15");
    await expect.poll(() => readReminder(user.id)).toMatchObject({ emailOn: true, time: "07:15" });

    await page.context().close();
  });

  test("the email's unsubscribe link changes nothing until its button turns email off", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    await prisma.studyReminder.create({
      data: { emailOn: true, locale: "en", time: "19:00", userId: user.id },
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/study-reminders/unsubscribe?token=${signUnsubscribeToken(user.id)}`);

    const turnOff = page.getByRole("button", { name: "Turn off" });
    await expectHydrated(turnOff);
    await expect(readReminder(user.id)).resolves.toMatchObject({ emailOn: true });

    await turnOff.click();
    await expect(page.getByRole("heading", { name: "Email reminders are off" })).toBeVisible();
    await expect(readReminder(user.id)).resolves.toMatchObject({ emailOn: false });

    await context.close();
  });
});
