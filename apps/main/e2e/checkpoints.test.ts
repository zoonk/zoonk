import {
  CHECKPOINT_PASS_MARK,
  CHECKPOINT_QUESTIONS,
  createCheckpointLearner,
  playDuel,
} from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

test.describe("A checkpoint from today's session", () => {
  test("continues back to the session by keyboard, to the day's summary", async ({ browser }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    // Keys work once the page hydrates, so each first press retries until the screen changes.
    await expect(async () => {
      await page.keyboard.press("Enter");

      // Its intro is the challenge's page, keeping the session it came from.
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

    await playDuel(page, { keyboard: true, passMark: CHECKPOINT_PASS_MARK });

    // Enter leaves the single-screen result for the session.
    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");
    await page.keyboard.press("Enter");

    // The checkpoint was the day's only block, so the session shows the day's summary.
    await expect(page).toHaveURL(/\/session$/u);
    // Winning the first checkpoint earned the Star glasses: their moment opens over the summary,
    // and Enter puts them on.
    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony.getByRole("button", { name: "Wear them" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(ceremony).toBeHidden();

    // The step under it takes the focus, and Enter finishes the day.
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today$/u);

    await page.context().close();
  });
});
