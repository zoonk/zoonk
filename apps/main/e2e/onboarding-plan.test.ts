import {
  type PlanTimeToCover,
  type PlanTimeToCoverInput,
} from "@zoonk/core/plans/time-advice-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

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

    await page.reload();
    await expect(page.getByText("Question 2", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "I don't know yet" }).click();
    await expect(page.getByText("Question 3", { exact: true })).toBeVisible();

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

  await page.getByLabel("Time a day", { exact: true }).selectOption("45");

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
  await expect(page.getByLabel("Time a day", { exact: true })).toHaveValue("45");

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
  await expect(page.getByText("45 min a day", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "That didn't save." })).toBeHidden();
});

test("waits for the time new study days need before saving the suggestion", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);
  const targetDate = new Date(Date.now() + 60 * 86_400_000);

  await prisma.goal.update({
    data: {
      details: { answered: ANSWERED.filter((step) => step !== "schedule"), subject: "algebra" },
      targetDate,
    },
    where: { id: goal.id },
  });

  const release = Promise.withResolvers<null>();

  await page.route(`**/v1/goals/${goal.id}/plan/time-to-cover`, async (route) => {
    const week: PlanTimeToCoverInput = JSON.parse(route.request().postData() ?? "{}");
    const fewerDays = (week.studyDays?.length ?? 0) < 5;

    if (fewerDays) {
      await release.promise;
    }

    const minutes = fewerDays ? 45 : 30;

    const json: PlanTimeToCover = {
      coreMinutes: null,
      fittingDate: null,
      pastDate: false,
      readingNotice: false,
      ready: true,
      recommendedMinutes: minutes,
      suggested: { kind: "everything", minutes },
      targetDate: targetDate.toISOString().slice(0, 10),
      targetDateNamedMonth: false,
    };

    await route.fulfill({ json });
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { name: "Skip and start from the basics" }).click();

  const time = page.getByLabel("Time a day", { exact: true });
  const next = page.getByRole("button", { exact: true, name: "Continue" });

  await expect(time).toHaveValue("30");
  await page.getByRole("button", { exact: true, name: "Friday" }).click();
  await expect(next).toBeDisabled();

  release.resolve(null);
  await expect(time).toHaveValue("45");
  await next.click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

  const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
  expect(saved.dailyMinutes).toBe(45);
});

test("an exam's plan waits on the reveal while its notice is read, then shows on its own", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);

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

  await prisma.plan.update({ data: { noticeWaitUntil: null }, where: { goalId: goal.id } });

  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
});
