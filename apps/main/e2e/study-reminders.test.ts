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

function readActiveGoalId(userId: string) {
  return prisma.userLearningProfile
    .findUniqueOrThrow({ select: { activeGoalId: true }, where: { userId } })
    .then((profile) => profile.activeGoalId);
}

/** Another study day's goal moves to the learner, as a second active goal that isn't the active one. */
async function addOtherGoal(userId: string) {
  const other = await createStudyDay();

  await Promise.all([
    prisma.goal.update({ data: { userId }, where: { id: other.goal.id } }),
    prisma.studySession.update({ data: { userId }, where: { id: other.session.id } }),
    prisma.userLearningProfile.update({
      data: { activeGoalId: null },
      where: { userId: other.user.id },
    }),
  ]);

  return other.goal;
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

  test("a reminder's link offers its goal on Today and switches only on the learner's click", async ({
    browser,
  }) => {
    const day = await createStudyDay();
    const other = await addOtherGoal(day.user.id);
    const sessions = await prisma.studySession.count({ where: { userId: day.user.id } });
    const page = await openAs(browser, day.user);
    await page.goto(`/today?goal=${other.id}`);

    const switchGoal = page.getByRole("button", { name: "Switch to this goal" });
    await expectHydrated(switchGoal);
    await expect(page.getByText(`Your study reminder was for ${other.title}.`)).toBeVisible();
    await expect(readActiveGoalId(day.user.id)).resolves.toBe(day.goal.id);

    await expect(prisma.studySession.count({ where: { userId: day.user.id } })).resolves.toBe(
      sessions,
    );

    await switchGoal.click();
    await expect(page).toHaveURL(/\/today$/u);
    await expect.poll(() => readActiveGoalId(day.user.id)).toBe(other.id);
    await expect(switchGoal).toBeHidden();

    await page.context().close();
  });

  test("a link to another learner's, an archived or the active goal offers nothing", async ({
    browser,
  }) => {
    const [day, stranger] = await Promise.all([createStudyDay(), createStudyDay()]);
    const archived = await addOtherGoal(day.user.id);
    await prisma.goal.update({ data: { status: "archived" }, where: { id: archived.id } });
    const page = await openAs(browser, day.user);

    for (const goalId of [stranger.goal.id, archived.id, day.goal.id, "not-a-goal"]) {
      // oxlint-disable-next-line no-await-in-loop -- One page, one link at a time.
      await page.goto(`/today?goal=${goalId}`);
      // oxlint-disable-next-line no-await-in-loop -- Waits for the page each link opened.
      await expectHydrated(page.getByRole("button", { name: /^(?:Start|Continue)/u }));
      // oxlint-disable-next-line no-await-in-loop -- Checks the page each link opened.
      await expect(page.getByRole("button", { name: "Switch to this goal" })).toHaveCount(0);
    }

    await expect(readActiveGoalId(day.user.id)).resolves.toBe(day.goal.id);
    await page.context().close();
  });

  test("Today can't start the previous goal while a reminder's switch is on its way", async ({
    browser,
  }) => {
    const day = await createStudyDay();
    const other = await addOtherGoal(day.user.id);

    const block = await prisma.studySessionBlock.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { sessionId: day.session.id },
    });

    const page = await openAs(browser, day.user);
    await page.goto(`/today?goal=${other.id}`);

    const switchGoal = page.getByRole("button", { name: "Switch to this goal" });
    const start = page.getByRole("button", { name: /^(?:Start|Continue)/u });
    await expectHydrated(switchGoal);

    const held = Promise.withResolvers<null>();
    const sent = Promise.withResolvers<null>();

    await page.route("**/*", async (route) => {
      const request = route.request();

      if (request.headers()["next-action"] && request.postData()?.includes(other.id)) {
        sent.resolve(null);
        await held.promise;
      }

      await route.continue();
    });

    await switchGoal.click();
    await sent.promise;
    await start.click({ force: true });
    await page.keyboard.press("Enter");
    held.resolve(null);

    await expect(page).toHaveURL(/\/today$/u);
    await expect.poll(() => readActiveGoalId(day.user.id)).toBe(other.id);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ startedAt: null });

    await page.context().close();
  });
});
