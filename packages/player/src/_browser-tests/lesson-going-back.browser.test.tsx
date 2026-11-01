import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import {
  type ActivityContent,
  activityStep,
  explanationStep,
  languageStep,
} from "../preview/preview-steps";
import type * as ActivityAudio from "../activities/_utils/activity-audio";

const piano = vi.hoisted(() => {
  const stop = vi.fn();
  return { stop, voice: () => ({ ready: Promise.resolve(), start: vi.fn(), stop }) };
});

vi.mock("smplr", () => ({ Soundfont: piano.voice, SplendidGrandPiano: piano.voice }));

const audioStart = vi.hoisted((): { hold: Promise<unknown>; started: number } => ({
  hold: Promise.resolve(),
  started: 0,
}));

// A device can take a while to start its sound, and the learner can leave meanwhile.
vi.mock("../activities/_utils/activity-audio", async (importOriginal) => {
  const audio = await importOriginal<typeof ActivityAudio>();

  return {
    ...audio,
    startActivityAudio: async () => {
      await audioStart.hold;
      const context = await audio.startActivityAudio();
      audioStart.started += 1;
      return context;
    },
  };
});

const DEVICE_DELAY_KEY = "zoonk:rhythm-device-delay";
const LETTER_SOUND = "https://audio.zoonk.test/ja-a.mp3";

function immediateStops(stop: { mock: { calls: unknown[][] } }): number {
  return stop.mock.calls.filter((args) => args.length === 0).length;
}

const reading = explanationStep({
  text: "A chemical change makes a new substance.",
  title: "Two kinds of change",
});

function letter({ audioUrl, symbol }: { audioUrl: string | null; symbol: string }) {
  return languageStep("alphabet", {
    audioText: symbol,
    audioUrl,
    forms: [],
    pronunciation: `Say ${symbol} as it's written.`,
    readingAid: symbol,
    symbol,
  });
}

function playLesson(steps: Parameters<typeof buildLesson>[0]) {
  renderLessonPlayer({ lesson: buildLesson(steps) });
}

function activity(content: ActivityContent = activityContentFixtures.categorize) {
  return activityStep({ content });
}

async function sortItem({ group, item }: { group: string; item: string }) {
  await page.getByRole("button", { exact: true, name: item }).click();
  await page.getByRole("button", { name: `Put ${item} in ${group}` }).click();
}

async function goBackAndReturn() {
  await page.getByRole("button", { name: "Previous screen" }).click();
  await expect.element(page.getByRole("heading", { name: "Two kinds of change" })).toBeVisible();
  await page.getByRole("button", { name: /^Next/u }).click();
}

describe("going back to reread", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    audioStart.hold = Promise.resolve();
    audioStart.started = 0;
    localStorage.removeItem(DEVICE_DELAY_KEY);
  });

  it("keeps an activity as the learner left it until they come back and check it", async () => {
    playLesson([reading, activity()]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await sortItem({ group: "New substance", item: "Burning wood" });
    await page.getByRole("button", { exact: true, name: "Melting ice" }).click();

    await goBackAndReturn();

    await expect.element(page.getByText("1 of 3 sorted", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Put Melting ice in Same substance" }).click();
    await sortItem({ group: "New substance", item: "Rusting iron" });
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("brings a chart back where the learner moved it, never at the check's answer", async () => {
    const { calculator } = engineModeFixtures.formulaModel;
    playLesson([reading, activity({ ...calculator, template: "formulaModel" })]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await pressOnSlider("Extra per month", "ArrowRight", 2);
    await expect.element(valueInput()).not.toHaveValue("");
    const field = valueInput().element();
    const typed = field instanceof HTMLInputElement ? field.value : "";

    await goBackAndReturn();

    await expect
      .element(page.getByRole("slider", { name: "Extra per month" }))
      .toHaveAttribute("aria-valuenow", "100");

    await expect.element(valueInput()).toHaveValue(typed);
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("starts a missed activity over when it comes back", async () => {
    playLesson([reading, activity()]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await sortItem({ group: "Same substance", item: "Burning wood" });
    await sortItem({ group: "Same substance", item: "Melting ice" });
    await sortItem({ group: "New substance", item: "Rusting iron" });
    await checkActivity();
    await expectVerdict("Not quite");

    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Previous screen" }))
      .not.toBeInTheDocument();
  });

  it("starts a rhythm run or a sound check over when the learner leaves it halfway", async () => {
    localStorage.removeItem(DEVICE_DELAY_KEY);
    const stop = vi.spyOn(AudioScheduledSourceNode.prototype, "stop");
    playLesson([reading, activity(activityContentFixtures.rhythmTapper)]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await page.getByRole("button", { name: "Start the sound check" }).click();

    await expect
      .element(page.getByRole("button", { name: "Skip for now" }))
      .not.toBeInTheDocument();

    await goBackAndReturn();

    expect(immediateStops(stop)).toBeGreaterThan(0);

    await expect.element(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.getByRole("button", { name: "Start tapping" }).click();

    await expect
      .element(page.getByRole("button", { name: "Start tapping" }))
      .not.toBeInTheDocument();

    await goBackAndReturn();

    await expect.element(page.getByRole("button", { name: "Start tapping" })).toBeVisible();
  });

  it("plays a screen's sound as on arrival when the learner comes back to it", async () => {
    const played: string[] = [];

    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play(
      this: HTMLMediaElement,
    ) {
      played.push(this.src);
      return Promise.resolve();
    });

    renderLessonPlayer({
      lesson: buildLesson(
        [
          reading,
          letter({ audioUrl: LETTER_SOUND, symbol: "あ" }),
          letter({ audioUrl: null, symbol: "か" }),
        ],
        { language: "pt", targetLanguage: "ja" },
      ),
    });

    await page.getByRole("button", { name: /^Next/u }).click();
    await page.getByRole("button", { name: "Play pronunciation" }).click();
    await expect.element(page.getByRole("button", { name: "Pause pronunciation" })).toBeVisible();
    const playedBefore = played.length;

    await goBackAndReturn();

    await expect.poll(() => played.length).toBeGreaterThan(playedBefore);
    expect(new Set(played)).toStrictEqual(new Set([LETTER_SOUND]));
  });

  it("never starts a sound check its screen was left before its sound came on", async () => {
    localStorage.removeItem(DEVICE_DELAY_KEY);
    const sound = Promise.withResolvers<null>();
    audioStart.hold = sound.promise;
    playLesson([reading, activity(activityContentFixtures.rhythmTapper)]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await page.getByRole("button", { name: "Start the sound check" }).click();
    await page.getByRole("button", { name: "Previous screen" }).click();
    await expect.element(page.getByRole("heading", { name: "Two kinds of change" })).toBeVisible();
    const createOscillator = vi.spyOn(AudioContext.prototype, "createOscillator");
    sound.resolve(null);
    await expect.poll(() => audioStart.started).toBe(1);
    expect(createOscillator).not.toHaveBeenCalled();
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByRole("button", { name: "Start the sound check" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
  });

  it("stops a melody when the learner leaves it", async () => {
    playLesson([reading, activity(activityContentFixtures.notationPlayer)]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await page.getByRole("button", { name: "Play the melody" }).click();
    await expect.element(page.getByText(/^Bar \d of 4$/u)).toBeVisible();
    const stopsBefore = piano.stop.mock.calls.length;

    await goBackAndReturn();

    expect(piano.stop.mock.calls.length).toBeGreaterThan(stopsBefore);
    await expect.element(page.getByRole("button", { name: "Play the melody" })).toBeVisible();
  });
});
