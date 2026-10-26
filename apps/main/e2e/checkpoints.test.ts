import {
  CHECKPOINT_PASS_MARK,
  CHECKPOINT_QUESTIONS,
  createCheckpointLearner,
  playDuel,
} from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { openAs, pressUntil } from "./study-day";

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

    // Winning the first checkpoint earned the Star glasses: their moment opens first, right after
    // the duel, and Enter puts them on.
    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony.getByRole("button", { name: "Wear them" })).toBeFocused();
    await pressUntil(() => page.keyboard.press("Enter"), ceremony, { state: "hidden" });

    // Then the duel's result shows, and takes the focus.
    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeFocused();

    // Enter leaves the single-screen result for the session. The checkpoint was the day's only
    // block, so the session shows the day's summary, without the glasses' moment again.
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");

    await pressUntil(
      () => page.keyboard.press("Enter"),
      page.getByRole("heading", { level: 1, name: /^Done in /u }),
    );

    await expect(page).toHaveURL(/\/session$/u);
    await expect(ceremony).toBeHidden();
    await expect(page.getByRole("link", { name: "Finish" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today$/u);

    await page.context().close();
  });
});
