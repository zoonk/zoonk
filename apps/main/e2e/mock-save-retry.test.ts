import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { createAnytimeMockLearner } from "./anytime-mock-fixtures";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

type Answers = Awaited<ReturnType<typeof createAnytimeMockLearner>>["answers"];

async function answerShown(page: Page, answers: Answers) {
  const main = page.getByRole("main");
  const heading = (await main.getByRole("heading", { level: 2 }).textContent()) ?? "";
  const right = answers.get(heading.trim())?.right;

  await page.getByRole("radio", { name: right }).click();
  await expect(page.getByRole("radio", { checked: true, name: right })).toBeVisible();
}

async function countStoredAnswers(userId: string) {
  const rows = await prisma.mockExamAnswer.findMany({ where: { mockExam: { userId } } });
  return rows.filter((row) => row.answer !== null).length;
}

test.describe("Mock answers on a bad connection", () => {
  test("an answer that didn't get through is sent again, and every later one is saved", async ({
    browser,
  }) => {
    const { answers, user } = await createAnytimeMockLearner({ plus: true });
    const page = await openAs(browser, user);
    await page.clock.install();

    await page.goto("/mock/new");
    const subjects = page.getByRole("radiogroup", { name: "One subject" });
    await subjects.getByText("Mathematics", { exact: true }).click();
    await expect(subjects.getByRole("radio", { name: /^Mathematics/u })).toBeChecked();
    await page.getByRole("button", { name: /^Start/u }).click();
    await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
    await page.clock.pauseAt(new Date(Date.now() + 1000));

    let dropped = false;

    await page.route("**/*", async (route) => {
      const request = route.request();
      const isAction = request.method() === "POST" && request.headers()["next-action"];
      const isAnswer = (request.postData() ?? "").includes('"itemId"');

      if (!dropped && isAction && isAnswer) {
        dropped = true;
        await route.abort();
        return;
      }

      await route.fallback();
    });

    await answerShown(page, answers);

    const retrying = page.getByRole("status").filter({ hasText: "Not saved yet · retrying" });
    await expect(retrying).toBeVisible();
    await expect(retrying.getByRole("button", { name: "Retry" })).toBeEnabled();
    await page.clock.fastForward(1000);
    await expect.poll(() => countStoredAnswers(user.id)).toBe(1);
    await expect(retrying).toBeHidden();

    await page.getByRole("button", { name: /^Next/u }).click();
    await answerShown(page, answers);

    await expect.poll(() => countStoredAnswers(user.id)).toBe(2);
    await page.context().close();
  });
});
