import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { type Page, expect, test } from "./fixtures";
import { mapGoalSkills } from "./onboarding-fixtures";

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
