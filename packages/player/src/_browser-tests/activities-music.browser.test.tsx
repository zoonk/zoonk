import { rhythmTapTimes } from "@zoonk/core/library/activities/music";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
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
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep } from "../preview/preview-steps";

const DEVICE_DELAY_KEY = "zoonk:rhythm-device-delay";

const QUICK_RHYTHM = {
  ...activityContentFixtures.rhythmTapper,
  fields: { ...activityContentFixtures.rhythmTapper.fields, pattern: "x...x...", rounds: 1 },
};

const RHYTHM_TAPS_MS = rhythmTapTimes(QUICK_RHYTHM.fields);

const REAL_TIME_TEST_TIMEOUT_MS = 30_000;

const { byEar, byEarChoice } = engineModeFixtures.keyboardFretboard;

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

function sleepUntil(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, time - performance.now()));
  });
}

async function tapRhythm() {
  const start = performance.now();

  for (const tapMs of RHYTHM_TAPS_MS) {
    // oxlint-disable-next-line no-await-in-loop -- Each tap waits for its moment in the rhythm.
    await sleepUntil(start + tapMs);
    // oxlint-disable-next-line no-await-in-loop -- The taps are the rhythm, so they go in order.
    await press("Space");
  }
}

describe("music activities", () => {
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

  it("notation: a repeated bar is read once, and a second ending as its own bar", async () => {
    const fixture = activityContentFixtures.notationPlayer;

    openActivity({
      content: {
        ...fixture,
        fields: {
          ...fixture.fields,
          notation: "X:1\nM:4/4\nL:1/4\nK:C\n|:C D E F|1 G A B c:|2 c B A G|]",
        },
      },
      template: "notationPlayer",
    });

    await expect
      .element(page.getByText("Bar 1: C, D, E, F. Bar 2: G, A, B, C. Bar 3: C, B, A, G."))
      .toBeInTheDocument();
  });

  it("keyboard by ear: the sound isn't named until the notes heard are found", async () => {
    openActivity({ content: byEar, template: "keyboardFretboard" });
    await expect.element(page.getByText("By ear", { exact: true })).toBeVisible();
    await expect.element(page.getByText("2 notes", { exact: true })).not.toBeInTheDocument();
    await expect.element(pianoKey("C")).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Play the sound" }).click();
    await pianoKey("C").click();
    await pianoKey("G").click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("2 notes", { exact: true })).toBeVisible();
  });

  it("keyboard by ear: naming a chord wrong shows the chord that played", async () => {
    openActivity({ content: byEarChoice, template: "keyboardFretboard" });
    await page.getByRole("button", { name: "Play the sound" }).click();
    await page.getByRole("radio", { name: /A major chord/u }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("A minor", { exact: true })).toBeVisible();

    await expect
      .element(page.getByText(/^On the keys: (?=.*\bA\b)(?=.*\bC\b)(?=.*\bE\b)/u))
      .toBeInTheDocument();
  });

  it("rhythm: the sound check is asked once per device and can be taken again", async () => {
    const lesson = buildLesson([activityStep({ content: activityContentFixtures.rhythmTapper })]);

    const firstVisit = renderLessonPlayer({ lesson });
    await expect.element(page.getByRole("heading", { name: "Set up your sound" })).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect.element(page.getByRole("button", { name: "Start tapping" })).toBeVisible();

    firstVisit.unmount();
    localStorage.setItem(DEVICE_DELAY_KEY, "180");
    renderLessonPlayer({ lesson });
    await expect.element(page.getByRole("button", { name: "Start tapping" })).toBeVisible();
    await expectCount(page.getByRole("heading", { name: "Set up your sound" }), 0);

    await page.getByRole("button", { name: "Check the sound delay again" }).click();
    await expect.element(page.getByRole("heading", { name: "Set up your sound" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Start the sound check" })).toBeVisible();
  });

  it("rhythm: tapping on the beats is right", { timeout: REAL_TIME_TEST_TIMEOUT_MS }, async () => {
    openActivities({ contents: [QUICK_RHYTHM] });
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.getByRole("button", { name: "Start tapping" }).click();
    await waitForFrameWithText("Round 1 of 1");
    await tapRhythm();

    await expect.element(page.getByText("2 of 2 taps on time."), { timeout: 15_000 }).toBeVisible();

    await expect.element(page.getByRole("button", { name: "Try again" })).toBeVisible();

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("musicianship lesson: hear a chord, name it, then play one on guitar", async () => {
    openActivities({ contents: [byEarChoice, guitarChord] });
    await page.getByRole("button", { name: "Play the sound" }).click();
    await page.getByRole("radio", { name: /A minor chord/u }).click();
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
