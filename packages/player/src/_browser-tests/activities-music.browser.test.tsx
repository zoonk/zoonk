import { rhythmTapTimes } from "@zoonk/core/library/activities/music";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectCount,
  expectVerdict,
  focusOn,
  openActivities,
  openActivity,
  press,
} from "../_test-utils/activity-player";
import { activityStep } from "../_test-utils/lesson-steps";
import { buildLesson, renderLessonPlayer } from "../_test-utils/render-lesson-player";

/** Where the rhythm activities keep the device's measured sound delay. */
const DEVICE_DELAY_KEY = "zoonk:rhythm-device-delay";

/** When each tap of the son clave fixture should land, from the first, as core grades it. */
const CLAVE_TAPS_MS = rhythmTapTimes(activityContentFixtures.rhythmTapper.fields);

/** The sound check plays its clicks at 60 bpm. */
const SOUND_CHECK_INTERVAL_MS = 1000;

/**
 * Rhythms play in real time: the sound check and two runs of the clave take longer than a
 * browser test's default budget, so these tests keep the E2E's (Playwright's 30 seconds).
 */
const REAL_TIME_TEST_TIMEOUT_MS = 30_000;

const progression = {
  check: { explanation: "After G, the C chord sounds like a small lift.", kind: "interaction" },
  fields: {
    chords: [
      { quality: "major", root: "G" },
      { quality: "major", root: "C" },
      { quality: "major", root: "D" },
    ],
    hidden: 1,
    mode: "progression",
    options: [
      { id: "g", quality: "major", root: "G" },
      { id: "c", quality: "major", root: "C" },
      { id: "d", quality: "major", root: "D" },
    ],
    song: "Asa Branca",
  },
  prompt: "Which chord did you hear in the middle?",
  template: "earTrainer",
};

const guitarChord = {
  check: { explanation: "G major is G, B and D.", kind: "interaction" },
  fields: { instruments: ["guitar"], target: { kind: "chord", quality: "major", root: "G" } },
  prompt: "Play a G major chord.",
  template: "keyboardFretboard",
};

function pianoKey(name: string) {
  return page.getByRole("group", { name: "Piano keys" }).getByRole("button", { exact: true, name });
}

async function pickFret({ position, string }: { position: string; string: string }) {
  await page
    .getByRole("radiogroup", { name: string })
    .getByRole("radio", { name: position })
    .click();
}

/** Resolves on the first animation frame that shows `text`, checked in the page on every frame. */
function waitForFrameWithText(text: string) {
  return new Promise<void>((resolve) => {
    function check() {
      if ((document.body.textContent ?? "").includes(text)) {
        resolve();
        return;
      }

      requestAnimationFrame(check);
    }

    check();
  });
}

/** Waits for the first round on the page's own frames, since a tap's timing is the answer. */
async function waitForFirstRound() {
  await waitForFrameWithText("Round 1 of 2");
}

function sleepUntil(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, time - performance.now()));
  });
}

/** Taps along with the sound check's clicks, a second apart from the first measured one. */
async function tapAlongWithSoundCheck() {
  await waitForFrameWithText("Tap with each click · 1 of");
  const start = performance.now();

  for (const click of [0, 1, 2, 3, 4, 5]) {
    // oxlint-disable-next-line no-await-in-loop -- Each tap waits for its click.
    await sleepUntil(start + click * SOUND_CHECK_INTERVAL_MS);
    // oxlint-disable-next-line no-await-in-loop -- The taps follow the clicks in order.
    await press("Space");
  }
}

/** Taps the son clave on time: each Space press lands on its hit, measured from the first. */
async function tapClave() {
  const start = performance.now();

  for (const tapMs of CLAVE_TAPS_MS) {
    // oxlint-disable-next-line no-await-in-loop -- Each tap waits for its moment in the rhythm.
    await sleepUntil(start + tapMs);
    // oxlint-disable-next-line no-await-in-loop -- The taps are the rhythm, so they go in order.
    await press("Space");
  }
}

describe("music activities", () => {
  /** Each test starts on a device that hasn't done the sound check, like a fresh browser. */
  beforeEach(() => {
    localStorage.removeItem(DEVICE_DELAY_KEY);
  });

  it("keyboard: changing one note turns C major into C minor", async () => {
    openActivity({ template: "keyboardFretboard" });
    await expect.element(page.getByText("C minor", { exact: true })).toBeVisible();
    await expect.element(pianoKey("E")).toHaveAttribute("aria-pressed", "true");
    await expect.element(page.getByText("Same chord on guitar")).toBeVisible();
    await pianoKey("E").click();
    await pianoKey("E flat").click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("C, E♭, G")).toBeVisible();
  });

  it("keyboard: adding a note without taking one away isn't minor", async () => {
    openActivity({ template: "keyboardFretboard" });
    await pianoKey("E flat").click();
    await expect.element(page.getByText("On the keys: C, E flat, E, G")).toBeInTheDocument();
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("notation: the melody plays bar by bar in staff or tab", async () => {
    openActivity({ template: "notationPlayer" });
    await expect.element(page.getByText("Ode to Joy")).toBeVisible();
    await expect.element(page.getByText("Beethoven, 1824")).toBeVisible();
    await expect.element(page.getByText(/Bar 1: E, E, F, G\./u)).toBeInTheDocument();
    await page.getByRole("radio", { name: "Tab" }).click();
    await expect.element(page.getByRole("img", { name: "Ode to Joy" })).toBeVisible();
    await page.getByRole("button", { name: "Play the melody" }).click();
    await expect.element(page.getByText(/^Bar \d of 4$/u)).toBeVisible();
    await page.getByRole("button", { name: "Stop" }).click();
    await page.getByRole("radio", { name: "By steps" }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("ear trainer: a wrong interval shows what played and offers a comparison", async () => {
    openActivity({ template: "earTrainer" });
    await page.getByRole("button", { exact: true, name: "Play" }).click();
    await expect.element(page.getByRole("button", { name: "Play again" })).toBeVisible();
    await page.getByRole("radio", { name: "Perfect fourth" }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("7 half steps: C → G")).toBeVisible();

    await expect
      .element(page.getByText("Twinkle, Twinkle, Little Star", { exact: true }))
      .toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Hear your pick to compare" }))
      .toBeVisible();
  });

  it(
    "rhythm: a one-time sound check measures the device's delay",
    { timeout: REAL_TIME_TEST_TIMEOUT_MS },
    async () => {
      const lesson = buildLesson([activityStep({ content: activityContentFixtures.rhythmTapper })]);

      const firstVisit = renderLessonPlayer({ lesson });
      await expect.element(page.getByRole("heading", { name: "Set up your sound" })).toBeVisible();
      await page.getByRole("button", { name: "Start the sound check" }).click();
      await tapAlongWithSoundCheck();

      await expect
        .element(page.getByText(/^Sound on this device arrives/u), { timeout: 15_000 })
        .toBeVisible();

      await page.getByRole("button", { name: "Continue" }).click();
      await expect.element(page.getByRole("button", { name: "Start tapping" })).toBeVisible();

      // Measured once per device: the next visit goes straight to the rhythm.
      firstVisit.unmount();
      renderLessonPlayer({ lesson });
      await expect.element(page.getByRole("button", { name: "Start tapping" })).toBeVisible();
      await expectCount(page.getByRole("heading", { name: "Set up your sound" }), 0);

      await page.getByRole("button", { name: "Check the sound delay again" }).click();
      await expect.element(page.getByRole("heading", { name: "Set up your sound" })).toBeVisible();
      await page.getByRole("button", { name: "Skip for now" }).click();
      await expect.element(page.getByRole("button", { name: "Start tapping" })).toBeVisible();
    },
  );

  it(
    "rhythm: tapping on the beats is right, and one tap isn't",
    { timeout: REAL_TIME_TEST_TIMEOUT_MS },
    async () => {
      openActivity({ template: "rhythmTapper" });
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.getByRole("button", { name: "Start tapping" }).click();
      await waitForFirstRound();
      await press("Space");

      await expect
        .element(page.getByText(/^1 of 10 taps on time\./u), { timeout: 15_000 })
        .toBeVisible();

      await page.getByRole("button", { name: "Try again" }).click();
      await waitForFirstRound();
      await tapClave();

      await expect
        .element(page.getByText("10 of 10 taps on time."), { timeout: 15_000 })
        .toBeVisible();

      await checkActivity();
      await expectVerdict("Correct!");
    },
  );

  it("musicianship lesson: hear the chord change, then play it on guitar", async () => {
    openActivities({ contents: [progression, guitarChord] });
    await expect.element(page.getByText("Asa Branca")).toBeVisible();
    await expect.element(page.getByRole("listitem", { name: "The chord to name" })).toBeVisible();
    await page.getByRole("radio", { name: /C major/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();

    await pickFret({ position: "Fret 3, G", string: "Low E string" });
    await pickFret({ position: "Fret 2, B", string: "A string" });
    await pickFret({ position: "Open, D", string: "D string" });
    await pickFret({ position: "Open, G", string: "G string" });
    await pickFret({ position: "Open, B", string: "B string" });
    await pickFret({ position: "Fret 3, G", string: "High E string" });
    await checkActivity();
    await expectVerdict("Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
  });
});

describe("music activities with a keyboard only", () => {
  it("keyboard: changing one note turns C major into C minor", async () => {
    openActivity({ template: "keyboardFretboard" });
    await expect.element(page.getByText("C minor", { exact: true })).toBeVisible();
    await expect.element(pianoKey("E")).toHaveAttribute("aria-pressed", "true");
    await expect.element(page.getByText("Same chord on guitar")).toBeVisible();

    // One tab stop, the arrows move along the keys, Enter presses one.
    await focusOn(pianoKey("C"));
    await press("ArrowRight", 4);
    await expect.element(pianoKey("E")).toHaveFocus();
    await press("Enter");
    await press("ArrowLeft");
    await press("Enter");
    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");

    await expectVerdict("Correct!");
    await expect.element(page.getByText("C, E♭, G")).toBeVisible();
  });
});
