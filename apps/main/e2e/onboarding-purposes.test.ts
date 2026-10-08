import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { expect, test } from "./fixtures";

/**
 * What a learn goal is for decides its plan: work plans use cases from the learner's job (a career
 * change, asked in onboarding.test.ts, is built around the role they want). The
 * understanding is stored the way a real one is, so the flow runs without the AI task.
 */

test("work asks for the role and what it's used for there", async ({ page }) => {
  const goal = `statistics ${randomUUID().slice(0, 8)}`;

  await goalUnderstandingFixture({
    goal,
    result: {
      followUps: [],
      goals: [{ kind: "learn", subject: "statistics", title: "Learn statistics" }],
      route: "goals",
    },
  });

  await page.goto("/start");
  await page.getByRole("textbox", { name: "Your goal" }).fill(goal);
  await page.getByRole("button", { name: "Start with your goal" }).click();
  await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();
  await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

  await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

  await page.getByRole("radio", { name: /Use it at work/u }).click();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  const role = "What do you do at work?";
  await expect(page.getByRole("heading", { name: role })).toBeVisible();
  await page.getByRole("textbox", { name: "Your role" }).fill("Marketing analyst");
  await page.getByRole("textbox", { name: "What you'll use it for" }).fill("A/B tests");
  await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeEnabled();
  await expectAccessibleScreen(page, role);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
  ).toBeVisible();

  const saved = await prisma.goal.findFirstOrThrow({ where: { prompt: goal } });

  expect(saved.details).toMatchObject({
    purpose: "work",
    role: "Marketing analyst",
    tasks: "A/B tests",
  });
});
