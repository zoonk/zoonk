import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { checkActivity, expectVerdict, openActivity } from "../_test-utils/activity-player";
import { recordPlayedClips, speechClips } from "../_test-utils/speech-clips";

async function pickEnding(ending: string) {
  await page.getByRole("button", { exact: true, name: ending }).click();
}

describe("language activities", () => {
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
});
