import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { expectHydrated } from "./hydration";
import { openAs } from "./study-day";

const ENGLISH = {
  kind: "language",
  subject: "English",
  targetLanguage: "en",
  title: "Learn English",
};

const STATISTICS = { kind: "learn", subject: "Statistics", title: "Learn statistics" };

const LOCKED_NOTE = /Following more than one goal at a time comes with Plus/u;

async function createLearnerWithWaitingGoal() {
  const user = await createE2EUser(getBaseURL());
  const prompt = `learn english and statistics ${randomUUID().slice(0, 8)}`;

  const draft = await prisma.onboardingDraft.create({
    data: { language: "en", prompt, status: "understood", timeZone: "UTC", userId: user.id },
  });

  const toCardGoal = ({ subject, ...goal }: typeof ENGLISH | typeof STATISTICS) => ({
    draft: { details: { onboardingId: draft.id, subject }, language: "en", prompt, ...goal },
    examDates: [],
  });

  await prisma.onboardingDraft.update({
    data: {
      understanding: {
        goals: [toCardGoal(ENGLISH), toCardGoal(STATISTICS)],
        schedule: { dailyMinutes: 30, studyDays: null, studyTime: null, studyTimeNote: null },
        status: "goals",
      },
    },
    where: { id: draft.id },
  });

  const english = await goalFixture({
    details: { onboardingId: draft.id },
    kind: "language",
    targetLanguage: "en",
    title: ENGLISH.title,
    userId: user.id,
  });

  await Promise.all([
    planFixture({ goalId: english.id }),
    learningProfileFixture({ activeGoalId: english.id, userId: user.id }),
  ]);

  return { draft, user };
}

test.describe("Goals typed together beyond the free plan's one goal", () => {
  test("the card shows the second goal locked and starts only the first, with the whole day", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const words = `learn english and statistics, 30 min a day ${randomUUID().slice(0, 8)}`;

    await goalUnderstandingFixture({
      goal: words,
      result: {
        dailyMinutes: 30,
        followUps: [],
        goals: [
          { ...ENGLISH, kind: "language", ownLevel: "basic" },
          { ...STATISTICS, kind: "learn", ownLevel: "none" },
        ],
        route: "goals",
      },
      userId: noProgressUser.id,
    });

    await page.goto("/start");
    await page.getByRole("textbox", { name: "I want to" }).fill(words);
    await page.getByRole("button", { name: "Build my plan" }).click();

    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
    await expect(page.getByText(STATISTICS.title, { exact: true })).toBeVisible();
    await expect(page.getByText(LOCKED_NOTE)).toBeVisible();
    await expect(page.getByText(/These goals share your daily time/u)).toHaveCount(0);

    await page.getByRole("button", { name: "Looks right" }).click();
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    await expect(
      prisma.goal.findMany({
        select: { dailyMinutes: true, title: true },
        where: { prompt: words },
      }),
    ).resolves.toStrictEqual([{ dailyMinutes: 30, title: ENGLISH.title }]);
  });

  test("the waiting goal sits in the goal switcher, locked on Free and started from there with Plus", async ({
    browser,
  }) => {
    const { draft, user } = await createLearnerWithWaitingGoal();
    const page = await openAs(browser, user);

    await page.goto("/today");

    const switcher = page.getByRole("button", { name: /^Learn English.*Switch goal$/u });
    await expectHydrated(switcher);
    await switcher.click();

    await expect(
      page.getByRole("menuitem", { name: `${STATISTICS.title} Starts with Plus` }),
    ).toHaveAttribute("href", /\/subscription$/u);

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await page.reload();
    await expectHydrated(switcher);
    await switcher.click();
    await page.getByRole("menuitem", { name: `${STATISTICS.title} Ready to start` }).click();

    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    await expect(
      prisma.goal.count({
        where: { details: { equals: draft.id, path: ["onboardingId"] }, title: STATISTICS.title },
      }),
    ).resolves.toBe(1);

    await page.context().close();
  });
});
