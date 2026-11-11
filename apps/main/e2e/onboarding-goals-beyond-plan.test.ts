import { randomUUID } from "node:crypto";
import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
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

async function typeCard({ page, userId }: { page: Page; userId: string }) {
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
    userId,
  });

  await page.goto("/start");
  await page.getByRole("textbox", { name: "I want to" }).fill(words);
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();

  return words;
}

async function openCard({ browser, user }: { browser: Browser; user: E2EUser }) {
  const page = await openAs(browser, user);
  const words = await typeCard({ page, userId: user.id });
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

  return { draft, english, user };
}

test.describe("Goals typed together beyond the goals the free plan follows at once", () => {
  test("with room for one more goal, the card starts the first goal with the whole day and locks the second", async ({
    browser,
  }) => {
    const { user } = await createLearnerFollowing(2);
    const { page, words } = await openCard({ browser, user });

    await expect(
      page.getByRole("main").getByText(STATISTICS.subject, { exact: true }),
    ).toBeVisible();

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

  test("following as many goals as the free plan allows, the card shows the plan's limit, and Today brings it back once a goal is paused", async ({
    browser,
  }) => {
    const { user } = await createLearnerFollowing(3);
    const { page, words } = await openCard({ browser, user });

    await expect(
      page.getByRole("main").getByText(STATISTICS.subject, { exact: true }),
    ).toBeVisible();

    await expect(page.getByRole("alert").filter({ hasText: FULL })).toBeVisible();
    await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Looks right" })).toHaveCount(0);
    await expect(page.getByText(LOCKED_NOTE)).toHaveCount(0);

    await page.getByRole("link", { name: "Go to your Plan" }).click();
    await page.getByRole("button", { name: "Plan options" }).click();
    await page.getByRole("menuitem", { name: "Pause this goal" }).click();

    await expect(
      page.getByText("Nothing is planned until you resume it.").filter({ visible: true }),
    ).toBeVisible();

    await page.goto("/today");

    const offer = page.getByRole("region", { name: "What you wrote" });
    await expect(offer.getByText(words)).toBeVisible();
    await offer.getByRole("link", { name: "Continue" }).click();

    await expect(page.getByText(LOCKED_NOTE)).toBeVisible();
    await page.getByRole("button", { name: "Looks right" }).click();
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    await expect(
      prisma.goal.findMany({ select: { title: true }, where: { prompt: words } }),
    ).resolves.toStrictEqual([{ title: ENGLISH.title }]);

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

  test("a guest whose card has no room left is pointed to a free account, not to Plus", async ({
    page,
  }) => {
    const guestId = await ensureGuest(page);
    await typeCard({ page, userId: guestId });
    const elsewhere = await goalFixture({ title: "Started in another tab", userId: guestId });
    await planFixture({ goalId: elsewhere.id });

    await page.getByRole("button", { name: "Looks right" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Without an account, you can follow one goal." }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Create a free account" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: FULL })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "See Plus" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Looks right" })).toHaveCount(0);
  });

  test("the waiting goal sits in the goal switcher, waiting for room on Free and started from there with Plus", async ({
    browser,
  }) => {
    const { draft, user } = await createLearnerWithWaitingGoal();
    const page = await openAs(browser, user);

    await page.goto("/today");

    const switcher = page.getByRole("button", { name: /^Learn English.*Switch goal$/u });
    await expectHydrated(switcher);
    await switcher.click();

    await expect(
      page.getByRole("menuitem", { name: `${STATISTICS.subject} Pause a goal or get Plus` }),
    ).toBeVisible();

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await page.reload();
    await expectHydrated(switcher);
    await switcher.click();
    await page.getByRole("menuitem", { name: `${STATISTICS.subject} Ready to start` }).click();

    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    await expect(
      prisma.goal.count({
        where: { details: { equals: draft.id, path: ["onboardingId"] }, title: STATISTICS.title },
      }),
    ).resolves.toBe(1);

    await page.context().close();
  });

  test("a Free learner pauses a goal from the waiting goal's row, and the waiting goal starts", async ({
    browser,
  }) => {
    const { draft, english, user } = await createLearnerWithWaitingGoal();
    const page = await openAs(browser, user);

    await page.goto("/today");

    const switcher = page.getByRole("button", { name: /^Learn English.*Switch goal$/u });
    await expectHydrated(switcher);
    await switcher.click();

    await page
      .getByRole("menuitem", { name: `${STATISTICS.subject} Pause a goal or get Plus` })
      .click();

    const sheet = page.getByRole("dialog", { name: `Make room for ${STATISTICS.subject}` });

    await expect(sheet.getByRole("link", { name: "Get Plus" })).toHaveAttribute(
      "href",
      /\/subscription$/u,
    );

    await sheet.getByRole("button", { name: `Pause ${ENGLISH.title}` }).click();

    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);
    await expect(sheet).toHaveCount(0);

    await expect(
      prisma.goal.findMany({
        orderBy: { createdAt: "asc" },
        select: { status: true, title: true },
        where: {
          OR: [{ id: english.id }, { details: { equals: draft.id, path: ["onboardingId"] } }],
        },
      }),
    ).resolves.toStrictEqual([
      { status: "paused", title: ENGLISH.title },
      { status: "active", title: STATISTICS.title },
    ]);

    await page.context().close();
  });
});
