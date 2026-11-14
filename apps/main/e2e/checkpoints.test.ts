import {
  CHECKPOINT_QUESTIONS,
  answerDuelQuestion,
  createCheckpointLearner,
  playDuel,
} from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { holdActionAnswer } from "./held-action";
import { openAs, pressUntil } from "./study-day";

const question = (number: number) => `Question ${number} of ${CHECKPOINT_QUESTIONS}`;

test.describe("A checkpoint from today's session", () => {
  test("continues back to the session by keyboard, to the day's summary", async ({ browser }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    // Keys work once the page hydrates, so each first press retries until the screen changes.
    await expect(async () => {
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"), {
        timeout: 1000,
      });
    }).toPass({ timeout: 10_000 });

    await expect(async () => {
      await page.keyboard.press("Enter");

      await expect(
        page.getByRole("progressbar", { name: `Question 1 of ${CHECKPOINT_QUESTIONS}` }),
      ).toBeAttached({ timeout: 1000 });
    }).toPass({ timeout: 5000 });

    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}\\?session=`, "u"));

    await playDuel(page);

    // The plan's last challenge finishes the course: its certificate plays before the glasses.
    const certificate = page.getByRole("dialog", { name: "Course complete!" });
    await expect(certificate.getByRole("button", { name: /^Continue/u })).toBeFocused();
    await pressUntil(() => page.keyboard.press("Enter"), certificate, { visible: false });

    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony.getByRole("button", { name: "Wear them" })).toBeFocused();
    await pressUntil(() => page.keyboard.press("Enter"), ceremony, { visible: false });

    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeFocused();

    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");

    await pressUntil(
      () => page.keyboard.press("Enter"),
      page.getByRole("heading", { level: 1, name: /^Done in /u }),
    );

    // The summary's address may name its goal once it's read (`?goal=`), so only its path counts.
    await expect(page).toHaveURL((url) => url.pathname === "/session");
    await expect(ceremony).toBeHidden();
    await expect(page.getByRole("link", { name: "Finish" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today$/u);

    await page.context().close();
  });

  test("Back from the checkpoint its challenge opened finds the challenge ready to start", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);
    const checkpointUrl = new RegExp(`/checkpoint/${block.id}$`, "u");

    await page.goto(`/challenge/${boss.id}`);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(checkpointUrl);
    await expect(page.getByRole("progressbar", { name: question(1) })).toBeAttached();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(checkpointUrl);
    await expect(page.getByRole("progressbar", { name: question(1) })).toBeAttached();

    await page.context().close();
  });

  test("opened again, it asks after the questions answered in another tab", async ({ browser }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);
    const checkpointUrl = new RegExp(`/checkpoint/${block.id}$`, "u");

    await page.goto(`/challenge/${boss.id}`);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("progressbar", { name: question(1) })).toBeAttached();
    await page.goBack();

    const other = await page.context().newPage();
    await other.goto(`/checkpoint/${block.id}`);
    await answerDuelQuestion(other, 1);
    await expect(other.getByRole("progressbar", { name: question(2) })).toBeAttached();

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(checkpointUrl);
    await expect(page.getByRole("progressbar", { name: question(2) })).toBeAttached();

    await page.context().close();
  });

  test("leaving while its challenge starts keeps the learner where they went", async ({
    browser,
  }) => {
    const { boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);
    await page.goto(`/challenge/${boss.id}`);
    const start = await holdActionAnswer(page, `/challenge/${boss.id}`);

    await page.getByRole("button", { name: "Start" }).click();
    await start.held;
    await page.getByRole("link", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/today$/u);

    expect(await start.release(/\/checkpoint\//u)).toBe(false);
    await expect(page).toHaveURL(/\/today$/u);

    await page.context().close();
  });
});
