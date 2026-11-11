import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const ENGLISH = {
  kind: "language",
  subject: "English",
  targetLanguage: "en",
  title: "Learn English",
};

const STATISTICS = { kind: "learn", subject: "Statistics", title: "Learn statistics" };

const LOCKED_NOTE = /Following more goals at once comes with Plus/u;

const FULL = "You're following as many goals as the free plan allows.";

async function createLearnerFollowing(count: number) {
  const user = await createE2EUser(getBaseURL());

  const followed = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      goalFixture({ title: `Followed goal ${index + 1}`, userId: user.id }),
    ),
  );

  await Promise.all([
    ...followed.map((goal) => planFixture({ goalId: goal.id })),
    learningProfileFixture({ activeGoalId: followed[0]?.id ?? null, userId: user.id }),
  ]);

  return { followed, user };
}

async function openCard({ browser, user }: { browser: Browser; user: E2EUser }) {
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
    userId: user.id,
  });

  const page = await openAs(browser, user);
  await page.goto("/start");
  await page.getByRole("textbox", { name: "I want to" }).fill(words);
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();

  return { page, words };
}

async function createLearnerWithWaitingGoal() {
  const { user } = await createLearnerFollowing(2);
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
    prisma.userLearningProfile.update({
      data: { activeGoalId: english.id },
      where: { userId: user.id },
    }),
  ]);

  return { draft, user };
}

test.describe("Goals typed together beyond the goals the free plan follows at once", () => {
  test("with room for one more goal, the card starts the first goal with the whole day and locks the second", async ({
    browser,
  }) => {
    const { user } = await createLearnerFollowing(2);
    const { page, words } = await openCard({ browser, user });

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

    await page.context().close();
  });

  test("following as many goals as the free plan allows, the card shows the plan's limit instead of confirming", async ({
    browser,
  }) => {
    const { user } = await createLearnerFollowing(3);
    const { page } = await openCard({ browser, user });

    await expect(page.getByText(STATISTICS.title, { exact: true })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: FULL })).toBeVisible();
    await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to your Plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Looks right" })).toHaveCount(0);
    await expect(page.getByText(LOCKED_NOTE)).toHaveCount(0);

    await page.context().close();
  });

  test("a card whose last slot went elsewhere shows the plan's limit once refused, and starts again after a pause", async ({
    browser,
  }) => {
    const { user } = await createLearnerFollowing(2);
    const { page } = await openCard({ browser, user });
    const elsewhere = await goalFixture({ title: "Started in another tab", userId: user.id });
    await planFixture({ goalId: elsewhere.id });

    await page.getByRole("button", { name: "Looks right" }).click();

    await expect(page.getByRole("alert").filter({ hasText: FULL })).toBeVisible();
    await expect(page.getByText(LOCKED_NOTE)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Looks right" })).toHaveCount(0);

    await page.getByRole("link", { name: "Go to your Plan" }).click();
    await page.getByRole("button", { name: "Plan options" }).click();
    await page.getByRole("menuitem", { name: "Pause this goal" }).click();

    await expect(
      page.getByText("Nothing is planned until you resume it.").filter({ visible: true }),
    ).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("button", { name: "Looks right" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: FULL })).toHaveCount(0);
    await expect(page.getByText(LOCKED_NOTE)).toBeVisible();

    await page.context().close();
  });

  test("the waiting goal sits in the goal switcher, locked while the free plan is full and started from there with Plus", async ({
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
