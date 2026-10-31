import { rhythmTapTimes } from "@zoonk/core/library/activities/music";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { CANT_LISTEN_TODAY } from "../lesson/use-today-choice";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep } from "../preview/preview-steps";
import type * as RhythmClock from "../activities/rhythm-tapper/rhythm-clock";

const instrument = vi.hoisted(() => () => ({
  ready: Promise.resolve(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("smplr", () => ({ Soundfont: instrument, SplendidGrandPiano: instrument }));

const heard = vi.hoisted(() => ({ lastMs: Number.NaN }));

// A busy machine delivers a real key press late, so the rhythm's taps are stamped on the activity's own clock instead.
vi.mock("../activities/rhythm-tapper/rhythm-clock", async (importOriginal) => {
  const clock = await importOriginal<typeof RhythmClock>();

  return {
    heardAtMs: (context: AudioContext, audioTime: number) => {
      heard.lastMs = clock.heardAtMs(context, audioTime);
      return heard.lastMs;
    },
  };
});

const DEVICE_DELAY_KEY = "zoonk:rhythm-device-delay";

const QUICK_RHYTHM = {
  ...activityContentFixtures.rhythmTapper,
  fields: { ...activityContentFixtures.rhythmTapper.fields, pattern: "x...x...", rounds: 1 },
};

const RHYTHM_TAPS_MS = rhythmTapTimes(QUICK_RHYTHM.fields);

const REAL_TIME_TEST_TIMEOUT_MS = 30_000;

const PHONE = { height: 812, width: 375 };
const PHONE_LANDSCAPE = { height: 375, width: 812 };
const HALF_TAP_TARGET_PX = 21;
const SUBPIXEL_PX = 1;

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

function exploredStep(id: string) {
  const entry = previewEntries.find((item) => item.id === id);

  if (!entry) {
    throw new Error(`No preview entry ${id}`);
  }

  return entry.screen("explore");
}

function cutOffKeys(names: string[]) {
  const shown = document
    .querySelector("[data-slot='piano-keyboard-scroll']")
    ?.getBoundingClientRect();

  return names.filter((name) => {
    const key = pianoKey(name).element().getBoundingClientRect();
    return !shown || key.left < shown.left - SUBPIXEL_PX || key.right > shown.right + SUBPIXEL_PX;
  });
}

function tapsLandOn(key: Element) {
  key.scrollIntoView({ block: "nearest", inline: "center" });
  const { bottom, left, width } = key.getBoundingClientRect();
  const center = left + width / 2;

  return [center - HALF_TAP_TARGET_PX, center + HALF_TAP_TARGET_PX].every(
    (x) => document.elementFromPoint(x, bottom - 4)?.closest("button") === key,
  );
}

async function pickFret({ position, string }: { position: string; string: string }) {
  await page
    .getByRole("radiogroup", { name: string })
    .getByRole("radio", { name: position })
    .click();
}

function tapRhythm() {
  for (const tapMs of RHYTHM_TAPS_MS) {
    const tap = new KeyboardEvent("keydown", { bubbles: true, key: " " });
    Object.defineProperty(tap, "timeStamp", { value: heard.lastMs + tapMs });
    (document.activeElement ?? document.body).dispatchEvent(tap);
  }
}

describe("music activities", () => {
  beforeEach(() => {
    localStorage.removeItem(DEVICE_DELAY_KEY);
    localStorage.removeItem(CANT_LISTEN_TODAY);
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

    await expect
      .poll(() => document.querySelectorAll(".abcjs-tab-number").length)
      .toBeGreaterThan(0);

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

  it("notation: on a phone the tab wraps two bars a line, each line with its fret numbers", async () => {
    await atViewport(PHONE, async () => {
      openActivity({ template: "notationPlayer" });
      await page.getByRole("radio", { name: "Tab" }).click();

      await expect
        .poll(() => document.querySelectorAll(".abcjs-l1 .abcjs-tab-number").length)
        .toBeGreaterThan(0);
    });
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

  it("keyboard by ear: a learner who can't listen reads its notes for the rest of the day", async () => {
    const descending = {
      ...byEar,
      fields: { ...byEar.fields, target: { kind: "notes", notes: ["G", "C"] } },
    };

    const first = openActivity({ content: descending, template: "keyboardFretboard" });
    await page.getByRole("button", { name: "I can't listen now" }).click();
    await expect.element(page.getByRole("button", { name: "I can listen now" })).toHaveFocus();
    await expect.element(page.getByText("The sound plays: G, C").first()).toBeVisible();
    await expectCount(page.getByRole("button", { name: "Play the sound" }), 0);

    first.unmount();
    openActivity({ content: descending, template: "keyboardFretboard" });
    await expect.element(page.getByText("The sound plays: G, C").first()).toBeVisible();

    await page.getByRole("button", { name: "I can listen now" }).click();
    await expect.element(page.getByRole("button", { name: "Play the sound" })).toBeVisible();
    await expectCount(page.getByText("The sound plays: G, C"), 0);
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

  it("keyboard: an explored chord wider than a phone shows every key it marks, each easy to tap", async () => {
    await atViewport(PHONE, async () => {
      renderLessonPlayer({
        lesson: buildLesson([exploredStep("activity-keyboardFretboard-byEarChoice")]),
      });

      await expect.element(pianoKey("A")).toHaveAttribute("aria-pressed", "true");
      expect(cutOffKeys(["A", "C", "E"])).toStrictEqual([]);

      const keys = page.getByRole("group", { name: "Piano keys" }).getByRole("button").elements();
      expect(keys.filter((key) => !tapsLandOn(key))).toStrictEqual([]);
    });
  });

  it("keyboard: a chord off the keyboard's start stays in view when the phone turns upright", async () => {
    const gMajor = {
      ...activityContentFixtures.keyboardFretboard,
      fields: {
        ...activityContentFixtures.keyboardFretboard.fields,
        start: { kind: "chord", quality: "major", root: "G" },
      },
    };

    await atViewport(PHONE_LANDSCAPE, async () => {
      openActivity({ content: gMajor, template: "keyboardFretboard" });
      await expect.element(pianoKey("B")).toHaveAttribute("aria-pressed", "true");
      expect(cutOffKeys(["D", "G", "B"])).toStrictEqual([]);

      await page.viewport(PHONE.width, PHONE.height);
      await expect.poll(() => cutOffKeys(["D", "G", "B"])).toStrictEqual([]);
    });
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

    await expect
      .element(page.getByRole("button", { name: /Get ready…|Tap here/u }))
      .toHaveAttribute("aria-disabled", "false");

    tapRhythm();

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
