import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { checkActivity, expectVerdict, openActivity } from "../_test-utils/activity-player";
import { recordPlayedClips, speechClips } from "../_test-utils/speech-clips";

/** Five short clips play one after another in real time. */
const PLAYBACK_TIMEOUT_MS = 5000;

const LUCIA_SENTENCES = [
  "¡Hola!",
  "Soy Lucía.",
  "Ya tengo la mesa para el sábado.",
  "Al final no es a las nueve, es a las nueve y media.",
  "¡Nos vemos allí!",
];

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
    openActivity({ template: "sentenceBuilder" });
    await tapTiles(["Vienen", "cena"]);
    await page.getByRole("button", { name: "Remove cena" }).click();
    await tapTiles(["a", "cenar", "esta", "noche"]);
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("¿Venís a cenar esta noche?")).toBeVisible();
    await expect.element(page.getByText(/Vienen is the ustedes form/u)).toBeVisible();
  });

  it("pattern table: each blank takes its ending", async () => {
    openActivity({ template: "patternTable" });
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
    openActivity({ template: "listeningSpeed" });
    await expect.element(page.getByText("The words open after you answer")).toBeVisible();
    await expect.element(page.getByText(/es a las nueve y media/u)).not.toBeInTheDocument();
    await page.getByRole("radio", { name: "0.75×" }).click();
    await expect.element(page.getByRole("radio", { name: "0.75×" })).toBeChecked();
    await page.getByRole("radio", { name: "9:30" }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText(/es a las nueve y media/u)).toBeVisible();
  });

  it("listening: plays the generated message sentence by sentence at the speed picked", async () => {
    const clips = speechClips();
    const played = recordPlayedClips();
    openActivity({ template: "listeningSpeed", voice: clips.voice });

    await page.getByRole("radio", { name: "0.75×" }).click();
    await page.getByRole("button", { name: "Play the message" }).click();

    await expect
      .poll(() => played.map((clip) => clips.textOf(clip.src)), { timeout: PLAYBACK_TIMEOUT_MS })
      .toStrictEqual(LUCIA_SENTENCES);

    expect(played.every((clip) => clip.rate === 0.75 && clip.preservesPitch)).toBe(true);

    expect(clips.voice.mock.calls.map(([input]) => input)).toStrictEqual(
      LUCIA_SENTENCES.map((text) => ({ language: "es", text })),
    );

    // After the last sentence the message is back at its start, ready to play again.
    await expect.element(page.getByRole("button", { name: "Play the message" })).toBeVisible();
    await expect.element(page.getByText("Sentence 1 of 5")).toBeVisible();
  });

  it("listening: a message that didn't come offers to try again", async () => {
    const clips = speechClips();
    clips.voice.mockResolvedValueOnce({ limit: null, status: "failed" });
    openActivity({ template: "listeningSpeed", voice: clips.voice });

    await page.getByRole("button", { name: "Play the message" }).click();
    await expect.element(page.getByText("The audio didn't play.")).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Try again" }).click();

    await expect.element(page.getByText("The audio didn't play.")).not.toBeInTheDocument();

    await expect
      .poll(() => clips.voice.mock.calls.length, { timeout: PLAYBACK_TIMEOUT_MS })
      .toBe(LUCIA_SENTENCES.length + 1);
  });

  it("dialogue: a line's voice shows it's loading the first time, then plays it", async () => {
    const clips = speechClips();
    const played = recordPlayedClips();
    const answer = clips.voice.getMockImplementation();
    const gate = Promise.withResolvers<null>();

    clips.voice.mockImplementationOnce(async (input) => {
      await gate.promise;
      return answer ? answer(input) : { limit: null, status: "failed" };
    });

    openActivity({ template: "dialogueSimulator", voice: clips.voice });
    await page.getByRole("button", { name: "Hear this line" }).click();

    await expect
      .element(page.getByRole("button", { name: "Getting the audio ready…" }))
      .toHaveAttribute("aria-busy", "true");

    gate.resolve(null);

    await expect
      .poll(() => played.map((clip) => clips.textOf(clip.src)))
      .toStrictEqual(["Buenos días, dígame."]);

    await expect.element(page.getByRole("button", { name: "Hear this line" })).toBeVisible();
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
