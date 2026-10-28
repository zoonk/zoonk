import { CHECKPOINT_QUESTIONS, createCheckpointLearner, playDuel } from "./checkpoint-fixtures";
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
});
