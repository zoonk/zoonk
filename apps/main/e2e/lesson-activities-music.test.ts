import { randomUUID } from "node:crypto";
import { rhythmTapTimes } from "@zoonk/core/library/activities/music";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { checkActivity, expectVerdict, openActivity } from "./activity-lesson";
import { type Page, expect, test } from "./fixtures";
import { MODES, type Mode, setDeviceMode } from "./learn-personas";

/** When each tap of the son clave fixture should land, from the first, as core grades it. */
const CLAVE_TAPS_MS = rhythmTapTimes(activityContentFixtures.rhythmTapper.fields);

/** The sound check plays its clicks at 60 bpm. */
const SOUND_CHECK_INTERVAL_MS = 1000;

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

/** A musicianship lesson: its screens in order, opened in the requested mode. */
async function openMusicianshipLesson(page: Page, mode: Mode) {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    title: `E2E musicianship ${randomUUID()}`,
  });

  await Promise.all(
    [progression, guitarChord].map((content, position) =>
      libraryStepFixture({ content, kind: "activity", lessonId: lesson.id, position }),
    ),
  );

  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lesson.id}`);
}

function pianoKey(page: Page, name: string) {
  return page.getByRole("group", { name: "Piano keys" }).getByRole("button", { exact: true, name });
}

async function pickFret(page: Page, { position, string }: { position: string; string: string }) {
  await page
    .getByRole("radiogroup", { name: string })
    .getByRole("radio", { name: position })
    .check();
}

/** Waits for the first round on the page's own frames, since a tap's timing is the answer. */
async function waitForFirstRound(page: Page) {
  await page.waitForFunction(
    () => (document.body.textContent ?? "").includes("Round 1 of 2"),
    null,
    { polling: "raf" },
  );
}

function sleepUntil(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, time - performance.now()));
  });
}

/** Taps along with the sound check's clicks, a second apart from the first measured one. */
async function tapAlongWithSoundCheck(page: Page) {
  await page.waitForFunction(
    () => (document.body.textContent ?? "").includes("Tap with each click · 1 of"),
    null,
    { polling: "raf" },
  );

  const start = performance.now();

  for (const click of [0, 1, 2, 3, 4, 5]) {
    // oxlint-disable-next-line no-await-in-loop -- Each tap waits for its click.
    await sleepUntil(start + click * SOUND_CHECK_INTERVAL_MS);
    // oxlint-disable-next-line no-await-in-loop -- The taps follow the clicks in order.
    await page.keyboard.press("Space");
  }
}

/** Taps the son clave on time: each Space press lands on its hit, measured from the first. */
async function tapClave(page: Page) {
  const start = performance.now();

  for (const tapMs of CLAVE_TAPS_MS) {
    // oxlint-disable-next-line no-await-in-loop -- Each tap waits for its moment in the rhythm.
    await sleepUntil(start + tapMs);
    // oxlint-disable-next-line no-await-in-loop -- The taps are the rhythm, so they go in order.
    await page.keyboard.press("Space");
  }
}

for (const mode of MODES) {
  test.describe(`music activities in ${mode} mode`, () => {
    test("keyboard: changing one note turns C major into C minor", async ({ page }) => {
      await openActivity(page, { mode, template: "keyboardFretboard" });
      await expect(page.getByText("C minor", { exact: true })).toBeVisible();
      await expect(pianoKey(page, "E")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("Same chord on guitar")).toBeVisible();

      if (mode === "focus") {
        // Keyboard only: one tab stop, the arrows move along the keys, Enter presses one.
        await pianoKey(page, "C").focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await expect(pianoKey(page, "E")).toBeFocused();
        await page.keyboard.press("Enter");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Enter");
        await page.getByRole("button", { name: "Check" }).focus();
        await page.keyboard.press("Enter");
      } else {
        await pianoKey(page, "E").click();
        await pianoKey(page, "E flat").click();
        await checkActivity(page);
      }

      await expectVerdict(page, "Correct!");
      await expect(page.getByText("C, E♭, G")).toBeVisible();
    });

    test("keyboard: adding a note without taking one away isn't minor", async ({ page }) => {
      await openActivity(page, { mode, template: "keyboardFretboard" });
      await pianoKey(page, "E flat").click();
      await expect(page.getByText("On the keys: C, E flat, E, G")).toBeAttached();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("notation: the melody plays bar by bar in staff or tab", async ({ page }) => {
      await openActivity(page, { mode, template: "notationPlayer" });
      await expect(page.getByText("Ode to Joy")).toBeVisible();
      await expect(page.getByText("Beethoven, 1824")).toBeVisible();
      await expect(page.getByText(/Bar 1: E, E, F, G\./u)).toBeAttached();
      await page.getByRole("radio", { name: "Tab" }).check();
      await expect(page.getByRole("img", { name: "Ode to Joy" })).toBeVisible();
      await page.getByRole("button", { name: "Play the melody" }).click();
      await expect(page.getByText(/^Bar \d of 4$/u)).toBeVisible();
      await page.getByRole("button", { name: "Stop" }).click();
      await page.getByRole("radio", { name: "By steps" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("ear trainer: a wrong interval shows what played and offers a comparison", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "earTrainer" });
      await page.getByRole("button", { exact: true, name: "Play" }).click();
      await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
      await page.getByRole("radio", { name: "Perfect fourth" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("7 half steps: C → G")).toBeVisible();
      await expect(page.getByText("Twinkle, Twinkle, Little Star", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Hear your pick to compare" })).toBeVisible();
    });

    test("rhythm: a one-time sound check measures the device's delay", async ({ page }) => {
      await openActivity(page, { mode, template: "rhythmTapper" });
      await expect(page.getByRole("heading", { name: "Set up your sound" })).toBeVisible();
      await page.getByRole("button", { name: "Start the sound check" }).click();
      await tapAlongWithSoundCheck(page);

      await expect(page.getByText(/^Sound on this device arrives/u)).toBeVisible({
        timeout: 15_000,
      });

      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("button", { name: "Start tapping" })).toBeVisible();

      // Measured once per device: the next visit goes straight to the rhythm.
      await page.reload();
      await expect(page.getByRole("button", { name: "Start tapping" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Set up your sound" })).toHaveCount(0);

      await page.getByRole("button", { name: "Check the sound delay again" }).click();
      await expect(page.getByRole("heading", { name: "Set up your sound" })).toBeVisible();
      await page.getByRole("button", { name: "Skip for now" }).click();
      await expect(page.getByRole("button", { name: "Start tapping" })).toBeVisible();
    });

    test("rhythm: tapping on the beats is right, and one tap isn't", async ({ page }) => {
      await openActivity(page, { mode, template: "rhythmTapper" });
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.getByRole("button", { name: "Start tapping" }).click();
      await waitForFirstRound(page);
      await page.keyboard.press("Space");
      await expect(page.getByText(/^1 of 10 taps on time\./u)).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: "Try again" }).click();
      await waitForFirstRound(page);
      await tapClave(page);
      await expect(page.getByText("10 of 10 taps on time.")).toBeVisible({ timeout: 15_000 });
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("musicianship lesson: hear the chord change, then play it on guitar", async ({ page }) => {
      await openMusicianshipLesson(page, mode);
      await expect(page.getByText("Asa Branca")).toBeVisible();
      await expect(page.getByRole("listitem", { name: "The chord to name" })).toBeVisible();
      await page.getByRole("radio", { name: /C major/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await page.getByRole("button", { name: /^Continue/u }).click();

      await pickFret(page, { position: "Fret 3, G", string: "Low E string" });
      await pickFret(page, { position: "Fret 2, B", string: "A string" });
      await pickFret(page, { position: "Open, D", string: "D string" });
      await pickFret(page, { position: "Open, G", string: "G string" });
      await pickFret(page, { position: "Open, B", string: "B string" });
      await pickFret(page, { position: "Fret 3, G", string: "High E string" });
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await page.getByRole("button", { name: /^Continue/u }).click();
      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    });
  });
}
