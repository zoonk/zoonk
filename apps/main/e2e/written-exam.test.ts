import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";
import {
  SHORT_TITLE,
  addGradedAnswer,
  createWrittenExamDay,
  useTodayExtraGrades,
} from "./written-exam-fixtures";

const DRAFT = "Internal control is done by each branch over its own acts.";

test.describe("Written exam practice", () => {
  test("Today's tap starts the written question, and its draft follows the learner to another device", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay();
    const page = await openAs(browser, day.user);

    try {
      await page.goto("/today");
      await page.getByRole("button", { name: "Start" }).click();
      await expect(page).toHaveURL(new RegExp(`/essay/${day.blockId}`, "u"));
      await expect(page.getByRole("heading", { level: 1, name: SHORT_TITLE })).toBeVisible();

      await page.getByRole("button", { exact: true, name: "Write" }).click();
      const field = page.getByLabel("Your answer");

      const saved = page.waitForResponse(
        (response) => response.request().method() === "PUT" && response.ok(),
      );

      await field.fill(DRAFT);
      await expect(page.getByText("about 2 of 30 lines")).toBeVisible();
      await saved;

      await expect
        .poll(async () => {
          const block = await prisma.studySessionBlock.findUniqueOrThrow({
            where: { id: day.blockId },
          });

          return JSON.stringify(block.payload).includes(DRAFT);
        })
        .toBe(true);

      const other = await openAs(browser, day.user);

      try {
        await other.goto(`/essay/${day.blockId}`);
        await other.getByRole("button", { exact: true, name: "Continue" }).click();
        await expect(other.getByLabel("Your answer")).toHaveValue(DRAFT);

        // E2E never reaches a model, so grading fails as an outage would and the text stays.
        await other.getByRole("button", { name: "Grade answer" }).click();

        await expect(
          other.getByText(/That didn't go through\. Your text is still here\./u),
        ).toBeVisible();

        await expect(other.getByLabel("Your answer")).toHaveValue(DRAFT);
      } finally {
        await other.context().close();
      }
    } finally {
      await page.context().close();
    }
  });

  test("a graded answer shows its range and marked errors, and a rewrite past the day's extra grades is refused before writing", async ({
    browser,
  }) => {
    const day = await createWrittenExamDay();
    const [item] = day.items;

    if (!item) {
      throw new Error("Expected a prompt");
    }

    await addGradedAnswer({
      blockId: day.blockId,
      itemId: item.id,
      sessionId: day.sessionId,
      userId: day.user.id,
    });

    const page = await openAs(browser, day.user);

    try {
      await page.goto(`/essay/${day.blockId}`);

      await expect(
        page.getByRole("heading", { level: 1, name: /^Your answer\s*16\.6–18\.7\s*of 30$/u }),
      ).toBeVisible();

      await expect(
        page.getByText("Minimum to pass the written test: 50% of the points"),
      ).toBeVisible();

      await expect(
        page.getByRole("list", { name: "Language errors" }).getByRole("listitem"),
      ).toHaveCount(1);

      await useTodayExtraGrades(day.user.id);
      await page.getByRole("button", { exact: true, name: "Rewrite" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "No more grading today" }),
      ).toBeVisible();

      await expect(page.getByText(SHORT_TITLE)).toBeVisible();
      await expect(page.getByLabel("Rewrite what needs work")).toBeHidden();

      // The written test's page knows the day's grading is used, so it offers no tap to refuse.
      await page.goto("/plan/written-test");
      await expect(page.getByText("More grading tomorrow")).toBeVisible();
      await expect(page.getByRole("button", { exact: true, name: "Write" })).toBeHidden();
    } finally {
      await page.context().close();
    }
  });

  test("a question still being written shows its wait, and the written test starts on its own clock", async ({
    browser,
  }) => {
    const missing = await createWrittenExamDay({ prompts: false });
    const day = await createWrittenExamDay({ plus: true });

    const [waiting, page] = await Promise.all([
      openAs(browser, missing.user),
      openAs(browser, day.user),
    ]);

    try {
      // The run's model never answers in E2E, so the question stays in writing.
      await waiting.goto("/today");
      await waiting.getByRole("button", { name: "Start" }).click();
      await expect(waiting).toHaveURL(new RegExp(`/essay/${missing.blockId}\\?writing=`, "u"));

      await expect(
        waiting.getByRole("heading", { level: 1, name: "Writing your question…" }),
      ).toBeVisible();

      await page.goto("/mock/new");
      await page.getByRole("radio", { name: /^Written test/u }).click();
      await page.getByRole("button", { name: "Start" }).click();
      await expect(page).toHaveURL(/\/mock\/[0-9a-f-]{36}/u);
      await expect(page.getByText(/^about 0 of (?<lines>30|60) lines$/u)).toBeVisible();
    } finally {
      await Promise.all([waiting.context().close(), page.context().close()]);
    }
  });
});
