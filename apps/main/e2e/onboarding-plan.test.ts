import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

/**
 * The end of onboarding: placement while the plan is being made, then the plan. The goal is one
 * whose skill map is already written, the way the goal workflow leaves it. Core's placement and
 * time advice tests cover what's asked and what's offered; these cover the pages around them.
 */

/** A moment this many minutes from now (before it, when negative). */
function inMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

test.describe("Placement and the plan", () => {
  test("placement adapts to answers, survives a refresh, welcomes 'I don't know yet' and ends with the plan", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createMappedGoal(noProgressUser.id);
    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    const question = page.getByRole("heading", { name: /^Question/u });
    await expect(question).toBeVisible();
    const first = await question.textContent();
    await page.keyboard.press("1");
    await expect(page.getByRole("radio", { name: /Right answer/u })).toBeChecked();
    await page.keyboard.press("Enter");

    await expect(question).not.toHaveText(first ?? "");
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();

    // A refresh comes back to placement's next question instead of its start.
    await page.reload();
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "I don't know yet" }).click();
    await expect(page.getByText("Question 3", { exact: true })).toBeVisible();

    // The answer saves before the next question takes input.
    const stop = page.getByRole("button", { name: "Stop here and see my plan" });
    await expect(stop).toBeEnabled();
    await stop.click();

    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/today");

    const [attempts, saved] = await Promise.all([
      prisma.attempt.count({ where: { itemId: { not: null }, userId: noProgressUser.id } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(saved.details).toMatchObject({ answered: expect.arrayContaining(["placement"]) });
  });
});

// An IELTS learner's time was lost when saving it crashed and "Try again" started the step over.
test("keeps the learner's time when saving it fails, and saves it on the next try", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible();

  await page
    .getByRole("radiogroup", { name: "Minutes a day" })
    .getByText("45 min", { exact: true })
    .click();

  // The first save of the time doesn't reach the server.
  let failSave = true;

  await page.route(`**/start/${goal.id}`, async (route) => {
    const request = route.request();
    const savesTime = request.method() === "POST" && request.postData()?.includes('"schedule"');

    if (savesTime && failSave) {
      failSave = false;
      await route.abort();
      return;
    }

    await route.continue();
  });

  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "That didn't save." })).toBeVisible();
  await expect(page.getByRole("radio", { name: "45 min" })).toBeChecked();

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
  await expect(page.getByText("45 min a day", { exact: true })).toBeVisible();
});

// Core's notice wait tests cover when the plan stops waiting; this covers the reveal following it.
test("an exam's plan waits on the reveal while its notice is read, then shows on its own", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

  // Placement is done; research is still reading the exam's notice.
  await Promise.all([
    prisma.goal.update({
      data: { details: { answered: [...ANSWERED, "placement"], subject: "algebra" } },
      where: { id: goal.id },
    }),
    prisma.plan.update({ data: { noticeWaitUntil: inMinutes(10) }, where: { goalId: goal.id } }),
  ]);

  await page.goto(`/start/${goal.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Reading the exam's official documents" }),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Start" })).toHaveCount(0);

  // The reading lands in the plan: the reveal shows it by itself.
  await prisma.plan.update({ data: { noticeWaitUntil: null }, where: { goalId: goal.id } });

  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
});
