import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { checkActivity, expectVerdict, openActivity } from "../_test-utils/activity-player";

async function tapTiles(words: string[]) {
  for (const word of words) {
    // oxlint-disable-next-line no-await-in-loop -- The sentence is built in order, one tile at a time.
    await page
      .getByRole("group", { name: "Word tiles" })
      .getByRole("button", { exact: true, name: word })
      .click();
  }
}

async function pickEnding(ending: string) {
  await page.getByRole("button", { exact: true, name: ending }).click();
}

describe("language activities", () => {
  it("sentence builder: the right words in order are right", async () => {
    openActivity({ template: "sentenceBuilder" });
    await expect.element(page.getByText("Text your friends in Madrid")).toBeVisible();
    await tapTiles(["Venís", "a", "cenar", "esta", "noche"]);

    await expect
      .element(page.getByText("Your sentence: Venís a cenar esta noche"))
      .toBeInTheDocument();

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("sentence builder: a distractor explains itself and a tile comes back out", async () => {
    openActivity({ mode: "fun", template: "sentenceBuilder" });
    await tapTiles(["Vienen", "cena"]);
    await page.getByRole("button", { name: "Remove cena" }).click();
    await tapTiles(["a", "cenar", "esta", "noche"]);
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("¿Venís a cenar esta noche?")).toBeVisible();
    await expect.element(page.getByText(/Vienen is the ustedes form/u)).toBeVisible();
  });

  it("pattern table: each blank takes its ending", async () => {
    openActivity({ mode: "fun", template: "patternTable" });
    await expect.element(page.getByText("Which ending does vosotros take?")).toBeVisible();
    await pickEnding("-éis");
    await expect.element(page.getByText("Which ending does ellos, ustedes take?")).toBeVisible();
    await pickEnding("-en");
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("pattern table: a wrong ending shows the right one", async () => {
    openActivity({ template: "patternTable" });
    await pickEnding("-áis");
    await pickEnding("-en");
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Correct answer: coméis")).toBeVisible();
  });

  it("dialogue: the polite reply is best and every reply says why", async () => {
    openActivity({ template: "dialogueSimulator" });
    await expect.element(page.getByText("Buenos días, dígame.")).toBeVisible();
    await page.getByRole("radio", { name: /Dame algo para la garganta/u }).click();
    await checkActivity();
    await expectVerdict("Not quite");

    await expect
      .element(page.getByText("No greeting and a bare command sound rude to a stranger."))
      .toBeVisible();

    await expect
      .element(page.getByText("Good morning. Do you have anything for a sore throat?"))
      .toBeVisible();
  });

  it("listening: the words stay hidden until the answer, then open", async () => {
    openActivity({ mode: "fun", template: "listeningSpeed" });
    await expect.element(page.getByText("The words open after you answer")).toBeVisible();
    await expect.element(page.getByText(/es a las nueve y media/u)).not.toBeInTheDocument();
    await page.getByRole("radio", { name: "0.75×" }).click();
    await expect.element(page.getByRole("radio", { name: "0.75×" })).toBeChecked();
    await page.getByRole("radio", { name: "9:30" }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText(/es a las nueve y media/u)).toBeVisible();
  });

  it("listening: a learner who can't listen can read the words", async () => {
    openActivity({ template: "listeningSpeed" });
    await page.getByRole("button", { name: "Can't listen now? Show the words" }).click();
    await expect.element(page.getByText(/es a las nueve y media/u)).toBeVisible();
    await page.getByRole("radio", { name: "9:00" }).click();
    await checkActivity();
    await expectVerdict("Not quite");
  });
});
