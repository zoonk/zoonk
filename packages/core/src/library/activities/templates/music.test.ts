import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { checkActivityAnswer } from "../activity-answers";
import { activityContentSchema, getActivityTemplate } from "../activity-templates";
import { validateActivity } from "../validate-activity";
import { estimateDeviceDelay, rhythmTapOffsets, rhythmTapTimes } from "./_utils/music";

const fixtures = activityContentFixtures;

function issueCodes(content: unknown): string[] {
  const result = validateActivity(content);
  return result.ok ? [] : result.issues.map((item) => item.code);
}

describe("rhythm timing", () => {
  const clave = { pattern: "x..x..x...x.x...", rounds: 2, stepsPerBeat: 4, tempo: 90 };

  it("places every tap of every round on the grid", () => {
    const times = rhythmTapTimes(clave);

    expect(times).toHaveLength(10);
    expect(times[0]).toBe(0);
    expect(times[5]).toBeCloseTo((16 * 60_000) / 90 / 4);
  });

  it("takes out a steady device delay but not a rhythm moved to other beats", () => {
    expect(
      rhythmTapOffsets({ expectedMs: [0, 500, 1000], tapsMs: [210, 700, 1220] }),
    ).toStrictEqual([0, -10, 10]);

    expect(
      rhythmTapOffsets({ expectedMs: [0, 500], tapsMs: [700, 1200] })?.every(
        (offset) => offset > 100,
      ),
    ).toBe(true);

    expect(rhythmTapOffsets({ expectedMs: [0, 500], tapsMs: [0] })).toBeNull();
  });

  it("takes out a measured device delay, then excuses only a small drift", () => {
    expect(
      rhythmTapOffsets({
        deviceDelayMs: 350,
        expectedMs: [0, 500, 1000],
        tapsMs: [360, 840, 1370],
      }),
    ).toStrictEqual([0, -20, 10]);

    // Dragging 150 ms behind the beat on a measured device is the learner's, not the device's.
    expect(
      rhythmTapOffsets({ deviceDelayMs: 0, expectedMs: [0, 500, 1000], tapsMs: [150, 650, 1150] }),
    ).toStrictEqual([90, 90, 90]);
  });

  it("grades a rhythm by the device's clock, forgiving one steady delay", () => {
    const tapper = activityContentSchema.parse(fixtures.rhythmTapper);
    const expected = rhythmTapTimes(clave);

    const late = expected.map((time) => time + 180);
    const wrongBeats = expected.map((time) => time + 670);
    const oneRushed = expected.map((time, index) => (index === 2 ? time - 150 : time));

    expect(checkActivityAnswer(tapper, { kind: "rhythm", tapTimesMs: late })).toBe(true);
    expect(checkActivityAnswer(tapper, { kind: "rhythm", tapTimesMs: wrongBeats })).toBe(false);
    expect(checkActivityAnswer(tapper, { kind: "rhythm", tapTimesMs: oneRushed })).toBe(false);

    // Bluetooth headphones 450 ms late: out of reach of the steady delay alone, fine once measured.
    const bluetooth = expected.map((time) => time + 450);

    expect(checkActivityAnswer(tapper, { kind: "rhythm", tapTimesMs: bluetooth })).toBe(false);

    expect(
      checkActivityAnswer(tapper, { deviceDelayMs: 440, kind: "rhythm", tapTimesMs: bluetooth }),
    ).toBe(true);
  });
});

describe(estimateDeviceDelay, () => {
  const clicksMs = [0, 1000, 2000, 3000, 4000, 5000];
  const intervalMs = 1000;

  const tapsAfter = (offsets: readonly number[]) =>
    offsets.map((offset, index) => (clicksMs[index] ?? 0) + offset);

  it("reads a steady delay as the middle of the taps' distances", () => {
    const tapsMs = tapsAfter([240, 260, 250, 230, 270, 250]);
    expect(estimateDeviceDelay({ clicksMs, intervalMs, tapsMs })).toBe(250);
  });

  it("isn't thrown off by a stray tap or taps a little ahead of the click", () => {
    const tapsMs = [...tapsAfter([-20, 10, 0, -10, 20, 0]), 2400];
    expect(estimateDeviceDelay({ clicksMs, intervalMs, tapsMs })).toBe(0);
  });

  it("reads Bluetooth headphones half a second late", () => {
    const tapsMs = tapsAfter([470, 480, 460, 490, 475, 480]);
    expect(estimateDeviceDelay({ clicksMs, intervalMs, tapsMs })).toBe(478);
  });

  it("asks again when too few taps matched a click", () => {
    expect(
      estimateDeviceDelay({ clicksMs, intervalMs, tapsMs: tapsAfter([100, 120, 110]) }),
    ).toBeNull();
  });
});

describe("keyboard and fretboard", () => {
  it("rejects a start that already is the target", () => {
    const same = {
      ...fixtures.keyboardFretboard,
      fields: {
        ...fixtures.keyboardFretboard.fields,
        start: { kind: "notes", notes: ["C", "Eb", "G"] },
      },
    };

    expect(issueCodes(same)).toContain("missingInteraction");
    expect(issueCodes(fixtures.keyboardFretboard)).toStrictEqual([]);
  });

  it("grades a sound found by ear by its notes, wherever they're played", () => {
    const fifth = activityContentSchema.parse(engineModeFixtures.keyboardFretboard.byEar);

    expect(getActivityTemplate("keyboardFretboard")?.computeExpected(fifth.fields)).toStrictEqual({
      kind: "pitchClasses",
      pitchClasses: [0, 7],
    });

    expect(checkActivityAnswer(fifth, { kind: "notes", notes: ["G3", "C4"] })).toBe(true);
    expect(checkActivityAnswer(fifth, { kind: "notes", notes: ["C4", "F4"] })).toBe(false);
  });
});

describe("notation player", () => {
  it("rejects notation without a key line before the notes", () => {
    const noKey = structuredClone(fixtures.notationPlayer);
    noKey.fields.notation = "E E F G | G F E D |";

    expect(issueCodes(noKey)).toContain("inconsistentFields");
    expect(issueCodes(fixtures.notationPlayer)).toStrictEqual([]);
  });
});
