import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { expectHydrated } from "./hydration";
import { mapGoalSkills } from "./onboarding-fixtures";
import { openAs } from "./study-day";

type Understanding = Parameters<typeof goalUnderstandingFixture>[0]["result"];

const GOAL_URL = /\/start\/[0-9a-f-]{36}$/u;

/** The time question asks the plan every 3 s while it's being built. */
const NEXT_CHECK_TIMEOUT_MS = 10_000;

async function storeUnderstanding(
  page: Page,
  { result, words }: { result: Understanding; words: string },
) {
  const goal = `${words} ${randomUUID().slice(0, 8)}`;
  await goalUnderstandingFixture({ goal, result, userId: await ensureGuest(page) });
  return goal;
}

const QUANTUM: Understanding = {
  followUps: [],
  goals: [{ kind: "learn", subject: "quantum physics", title: "Understand quantum physics" }],
  route: "goals",
};

test.describe("Onboarding from a typed goal", () => {
  test("a visitor goes from a goal in their words to a plan", async ({ page }) => {
    const goal = await storeUnderstanding(page, {
      result: QUANTUM,
      words: "i want to understand quantum physics",
    });

    await page.goto("/start");
    await page.getByRole("textbox", { name: "I want to" }).fill(goal);
    await page.getByRole("button", { name: "Build my plan" }).click();

    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
    await page.getByRole("button", { name: "Looks right" }).click();
    await expect(page).toHaveURL(GOAL_URL);
    const created = await prisma.goal.findFirstOrThrow({ where: { prompt: goal } });

    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();
    await page.getByRole("radio", { name: /Change careers/u }).click();

    await expect(page.getByRole("heading", { name: "Where are you headed?" })).toBeVisible();
    await page.getByRole("textbox", { name: "The role you want" }).fill("Data analyst");
    await page.getByRole("textbox", { name: "What you do now" }).fill("Teacher");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "No date" }).click();

    await expect(
      page.getByRole("heading", { name: "How much do you already know?" }),
    ).toBeVisible();

    await page.getByRole("radio", { name: /^The basics/u }).click();

    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await page.getByRole("button", { name: "Skip and start from the basics" }).click();

    await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();
    await mapGoalSkills({ goalId: created.id });

    const time = page.getByRole("heading", { name: "How much time can you study each day?" });
    await expect(time).toBeVisible({ timeout: NEXT_CHECK_TIMEOUT_MS });
    await page.reload();
    await expect(time).toBeVisible();

    await page.getByLabel("Time a day", { exact: true }).selectOption("30");
    await page.getByRole("button", { name: "Saturday" }).click();
    await page.getByRole("switch", { name: "Different time on weekends" }).click();
    await page.getByLabel("Time on weekends", { exact: true }).selectOption("60");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

    const saved = await prisma.goal.findUniqueOrThrow({
      include: { user: true },
      where: { id: created.id },
    });

    expect(saved.user.isAnonymous).toBe(true);
    expect(saved.dailyMinutes).toBe(30);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: created.id } }),
    ).resolves.toMatchObject({ settings: { weekdayMinutes: [0, 30, 30, 30, 30, 30, 60] } });

    expect(saved.details).toMatchObject({
      answered: expect.arrayContaining([
        "purpose",
        "role",
        "targetDate",
        "level",
        "schedule",
        "placement",
      ]),
      level: "basic",
      purpose: "careerChange",
      role: "Teacher",
      targetPosition: "Data analyst",
    });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: saved.userId },
    });

    expect(profile).toMatchObject({
      activeGoalId: created.id,
      buddyKind: "zu",
      memoryEnabled: true,
    });
  });
});

test("a learner who starts another goal from Today lands on it, never on the goal before it, and the next new goal starts empty", async ({
  browser,
}) => {
  const user = await createE2EUser(getBaseURL());
  const tag = `a${randomUUID().slice(0, 6)}`;
  const previousLesson = `Atoms ${tag}`;
  const words = `i want to understand quantum physics ${tag}`;

  const [previous, { lesson }] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Learn chemistry ${tag}`, userId: user.id }),
    playableLessonFixture({ lesson: { title: previousLesson }, steps: ["check"] }),
    goalUnderstandingFixture({ goal: words, result: QUANTUM, userId: user.id }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  await Promise.all([
    learningProfileFixture({ activeGoalId: previous.id, userId: user.id }),
    planFixture({ goalId: previous.id, items: [{ lessonId: lesson.id }] }),
  ]);

  const page = await openAs(browser, user);
  await page.goto("/today");
  await expect(page.getByRole("main").getByText(previousLesson).first()).toBeVisible();

  const switcher = page.getByRole("button", { name: /^Learn chemistry.*Switch goal$/u });
  await expectHydrated(switcher);
  await switcher.click();
  await page.getByRole("menuitem", { name: "Start a new goal" }).click();

  await page.getByRole("textbox", { name: "I want to" }).fill(words);
  await page.getByRole("button", { name: "Build my plan" }).click();
  await page.getByRole("button", { name: "Looks right" }).click();
  await expect(page).toHaveURL(GOAL_URL);
  const created = await prisma.goal.findFirstOrThrow({ where: { prompt: words } });

  await page.getByRole("radio", { name: /Change careers/u }).click();
  await page.getByRole("textbox", { name: "The role you want" }).fill("Data analyst");
  await page.getByRole("textbox", { name: "What you do now" }).fill("Teacher");
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.getByRole("button", { name: "No date" }).click();
  await page.getByRole("radio", { name: /^The basics/u }).click();
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();
  await mapGoalSkills({ goalId: created.id });

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible({ timeout: NEXT_CHECK_TIMEOUT_MS });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

  await page.evaluate((text) => {
    const showsPrevious = () =>
      [...document.querySelectorAll("main *")].some(
        (node) =>
          node.childElementCount === 0 &&
          node.textContent?.includes(text) &&
          node.checkVisibility(),
      );

    new MutationObserver(() => {
      if (showsPrevious()) {
        document.documentElement.dataset.sawPrevious = "true";
      }
    }).observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }, previousLesson);

  await page.getByRole("link", { name: "Start" }).press("Enter");
  await expect(page).toHaveURL(/\/today$/u);
  await expect(page.getByRole("main").getByText("Nothing new for today.")).toBeVisible();

  const newSwitcher = page.getByRole("button", {
    name: /^Understand quantum physics.*Switch goal$/u,
  });

  await expect(newSwitcher).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-saw-previous");

  await expectHydrated(newSwitcher);
  await newSwitcher.click();
  await page.getByRole("menuitem", { name: "Start a new goal" }).click();
  await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue("");
  await page.context().close();
});

test("a goal a link filled in doesn't fill the box again once it's made, on Back or on a new goal", async ({
  browser,
}) => {
  const user = await createE2EUser(getBaseURL());
  const words = `i want to understand quantum physics ${randomUUID().slice(0, 8)}`;

  await Promise.all([
    goalUnderstandingFixture({ goal: words, result: QUANTUM, userId: user.id }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const page = await openAs(browser, user);
  await page.goto(`/start?goal=${encodeURIComponent(words)}`);

  const send = page.getByRole("button", { name: "Build my plan" });
  await expectHydrated(send);
  await send.click();
  await page.getByRole("button", { name: "Looks right" }).click();
  await expect(page).toHaveURL(GOAL_URL);

  const box = page.getByRole("textbox", { name: "I want to" });
  await page.goBack();
  await expect(page).toHaveURL(/\/start$/u);
  await expect(box).toHaveValue("");
  await page.goForward();
  await expect(page).toHaveURL(GOAL_URL);

  const switcher = page.getByRole("button", { name: /^Understand quantum physics.*Switch goal$/u });
  await expectHydrated(switcher);
  await switcher.click();
  await page.getByRole("menuitem", { name: "Start a new goal" }).click();
  await expect(page).toHaveURL(/\/start$/u);
  await expect(box).toHaveValue("");
  await page.context().close();
});
