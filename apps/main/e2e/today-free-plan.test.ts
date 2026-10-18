import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs, pastFreeWeek } from "./study-day";

const MOCK_IN_DAYS = 3;
const PHONE = { height: 844, width: 390 };
const LOCKED_LESSONS = ["Percent changes in a row", "Discounts on discounts"];

/** A day as the plan's saved funding names it ("2026-10-17"). */
function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Ana on the free plan past its first week of exam prep, back after a break: her plan dates two new
 * lessons today, which only Plus opens, and saves time today for a mock her plan doesn't include.
 */
async function freeDayBack() {
  const { goal, user } = await createStudyDay({ freshStart: "welcomeBack" });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
  const today = toUTCMidnight(new Date());
  const mockDay = new Date(today.getTime() + MOCK_IN_DAYS * MS_PER_DAY);

  await Promise.all([
    pastFreeWeek(goal.id),
    ...LOCKED_LESSONS.map((title, index) =>
      planItemFixture({
        kind: "lesson",
        planId: plan.id,
        position: index + 1,
        scheduledFor: today,
        titleSnapshot: title,
      }),
    ),
    planItemFixture({
      kind: "mock",
      planId: plan.id,
      position: LOCKED_LESSONS.length + 1,
      scheduledFor: mockDay,
      titleSnapshot: "Full mock",
    }),
    prisma.plan.update({
      data: {
        settings: {
          ...(isJsonObject(plan.settings) ? plan.settings : {}),
          mockFunding: [
            {
              contributions: [{ date: toIsoDay(today), minutes: 5 }],
              date: toIsoDay(mockDay),
              minutes: 165,
            },
          ],
        },
      },
      where: { id: plan.id },
    }),
  ]);

  return { user };
}

test.describe("Today on a free exam plan past its first week", () => {
  // Ana's Today: "Welcome back! Today is lighter, about 11 min" and "2 activities so far · more as
  // you go", while the lessons her plan dated that day went unmentioned and nothing more came.
  test("lists today's plan lessons locked for Plus, and the mock it saves time for, without calling the day lighter", async ({
    browser,
  }) => {
    const { user } = await freeDayBack();
    const page = await openAs(browser, user);
    await page.setViewportSize(PHONE);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });

    // Each lesson as Plus learners see it, marked Plus, opening what Plus unlocks.
    await Promise.all(
      LOCKED_LESSONS.map(async (title) => {
        const row = card.getByRole("listitem").filter({ hasText: title });

        await expect(row).toContainText("Available with Plus");

        await expect(row.getByRole("link", { name: title })).toHaveAttribute(
          "href",
          "/subscription",
        );
      }),
    );

    // The day is short for what Plus holds, not lighter for the break, and nothing more comes.
    await expect(
      card.getByText(/^Welcome back! Today takes about .+, so it's easy to pick up again\.$/u),
    ).toBeVisible();

    await expect(page.getByRole("main").getByText(/lighter/iu)).toHaveCount(0);
    await expect(card.getByText(/more as you go/u)).toHaveCount(0);

    // The date line names the mock it saves time for, marked Plus.
    const saving = page.getByText(/^Saving time for .+'s mock exam$/u);

    await expect(saving).toBeVisible();
    await expect(saving.locator("..")).toContainText("Available with Plus");

    await page.screenshot({ fullPage: true, path: test.info().outputPath("today-free-plan.png") });
    await page.context().close();
  });

  // Ana's Today said "11 min studied" beside a 3-minute summary and a week that grew by 2: it
  // counted the plan's minutes for the blocks done.
  test("says the time studied once the day is done, the summary's minutes", async ({ browser }) => {
    const { session, user } = await createStudyDay();

    // The day's 7 planned minutes took 2 min 50 s.
    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { status: "completed" },
        where: { sessionId: session.id },
      }),
      learningEventFixture({
        contentIds: { studySessionId: session.id },
        seconds: 170,
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        { date: toUTCMidnight(new Date()), timeSpentSeconds: 170, userId: user.id },
      ]),
    ]);

    const page = await openAs(browser, user);
    await page.setViewportSize(PHONE);
    await page.goto("/session");

    await expect(page.getByRole("heading", { level: 1, name: /^Done in 2\smin$/u })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("summary-done-in.png") });

    await page.goto("/today");
    const card = page.getByRole("region", { name: "Today's session" });

    await expect(card.getByText(/^2\smin studied$/u).filter({ visible: true })).toBeVisible();

    await expect(
      card.getByRole("status").filter({ hasText: "Today's session is complete." }),
    ).toHaveText(/^Today's session is complete\.\s*2\smin$/u);

    // Done rows say they're done, not the plan's minutes for them.
    await expect(card.getByRole("listitem").first()).toHaveText(/^Quick review\s*, done$/u);

    await page.screenshot({ fullPage: true, path: test.info().outputPath("today-done.png") });
    await page.context().close();
  });
});
