import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { type Page, expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";

/**
 * What a learn goal is for decides its plan: work plans use cases from the learner's job, and a
 * career change is built around the role they want. The understanding is stored the way a real
 * one is, so the flow runs without the AI task.
 */

const STATISTICS = {
  followUps: [],
  goals: [{ kind: "learn" as const, subject: "statistics", title: "Learn statistics" }],
  route: "goals" as const,
};

async function startGoal(page: Page, { mode }: { mode: Mode }) {
  const goal = `statistics ${randomUUID().slice(0, 8)}`;
  await goalUnderstandingFixture({ goal, result: STATISTICS });
  await setDeviceMode(page.context(), mode);

  await page.goto("/start");
  await page.getByRole("textbox", { name: "Your goal" }).fill(goal);
  await page.getByRole("button", { name: "Start with your goal" }).click();
  await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();
  await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

  await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

  return goal;
}

async function savedDetails(prompt: string) {
  const goal = await prisma.goal.findFirstOrThrow({ where: { prompt } });
  return goal.details;
}

test.describe("What a learn goal is for", () => {
  test("a career change asks for the role they want and what they do now, in Focus", async ({
    page,
  }) => {
    const goal = await startGoal(page, { mode: "focus" });

    await page.getByRole("radio", { name: /Change careers/u }).click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Where are you headed?" })).toBeVisible();
    await page.getByRole("textbox", { name: "The role you want" }).fill("Data analyst");
    await page.getByRole("textbox", { name: "What you do now" }).fill("Teacher");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    expect(await savedDetails(goal)).toMatchObject({
      answered: expect.arrayContaining(["purpose", "role"]),
      purpose: "careerChange",
      role: "Teacher",
      targetPosition: "Data analyst",
    });
  });

  test("work asks for the role and what it's used for there, in Fun", async ({ page }) => {
    const goal = await startGoal(page, { mode: "fun" });

    await page.getByRole("radio", { name: /Use it at work/u }).click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "What do you do at work?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Your role" }).fill("Marketing analyst");
    await page.getByRole("textbox", { name: "What you'll use it for" }).fill("A/B tests");
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    expect(await savedDetails(goal)).toMatchObject({
      purpose: "work",
      role: "Marketing analyst",
      tasks: "A/B tests",
    });
  });
});
