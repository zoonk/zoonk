import { checkActivity, expectVerdict, openActivity } from "./activity-lesson";
import { type Page, expect, test } from "./fixtures";
import { MODES } from "./learn-personas";

async function tapTiles(page: Page, words: string[]) {
  for (const word of words) {
    // oxlint-disable-next-line no-await-in-loop -- The sentence is built in order, one tile at a time.
    await page
      .getByRole("group", { name: "Word tiles" })
      .getByRole("button", { exact: true, name: word })
      .click();
  }
}

async function pickEnding(page: Page, ending: string) {
  await page.getByRole("button", { exact: true, name: ending }).click();
}

for (const mode of MODES) {
  test.describe(`language activities in ${mode} mode`, () => {
    test("sentence builder: the right words in order are right", async ({ page }) => {
      await openActivity(page, { mode, template: "sentenceBuilder" });
      await expect(page.getByText("Text your friends in Madrid")).toBeVisible();
      await tapTiles(page, ["Venís", "a", "cenar", "esta", "noche"]);
      await expect(page.getByText("Your sentence: Venís a cenar esta noche")).toBeAttached();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("sentence builder: a distractor explains itself and a tile comes back out", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "sentenceBuilder" });
      await tapTiles(page, ["Vienen", "cena"]);
      await page.getByRole("button", { name: "Remove cena" }).click();
      await tapTiles(page, ["a", "cenar", "esta", "noche"]);
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("¿Venís a cenar esta noche?")).toBeVisible();
      await expect(page.getByText(/Vienen is the ustedes form/u)).toBeVisible();
    });

    test("pattern table: each blank takes its ending", async ({ page }) => {
      await openActivity(page, { mode, template: "patternTable" });
      await expect(page.getByText("Which ending does vosotros take?")).toBeVisible();
      await pickEnding(page, "-éis");
      await expect(page.getByText("Which ending does ellos, ustedes take?")).toBeVisible();
      await pickEnding(page, "-en");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("pattern table: a wrong ending shows the right one", async ({ page }) => {
      await openActivity(page, { mode, template: "patternTable" });
      await pickEnding(page, "-áis");
      await pickEnding(page, "-en");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Correct answer: coméis")).toBeVisible();
    });

    test("dialogue: the polite reply is best and every reply says why", async ({ page }) => {
      await openActivity(page, { mode, template: "dialogueSimulator" });
      await expect(page.getByText("Buenos días, dígame.")).toBeVisible();
      await page.getByRole("radio", { name: /Dame algo para la garganta/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");

      await expect(
        page.getByText("No greeting and a bare command sound rude to a stranger."),
      ).toBeVisible();

      await expect(
        page.getByText("Good morning. Do you have anything for a sore throat?"),
      ).toBeVisible();
    });

    test("listening: the words stay hidden until the answer, then open", async ({ page }) => {
      await openActivity(page, { mode, template: "listeningSpeed" });
      await expect(page.getByText("The words open after you answer")).toBeVisible();
      await expect(page.getByText(/es a las nueve y media/u)).toBeHidden();
      await page.getByRole("radio", { name: "0.75×" }).check();
      await expect(page.getByRole("radio", { name: "0.75×" })).toBeChecked();
      await page.getByRole("radio", { name: "9:30" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText(/es a las nueve y media/u)).toBeVisible();
    });

    test("listening: a learner who can't listen can read the words", async ({ page }) => {
      await openActivity(page, { mode, template: "listeningSpeed" });
      await page.getByRole("button", { name: "Can't listen now? Show the words" }).click();
      await expect(page.getByText(/es a las nueve y media/u)).toBeVisible();
      await page.getByRole("radio", { name: "9:00" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });
  });
}
