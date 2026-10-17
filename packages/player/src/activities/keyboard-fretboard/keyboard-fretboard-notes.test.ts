import { describe, expect, it } from "vitest";
import {
  answeringMarks,
  checkedMarks,
  fretWindowStart,
  pitchSpelling,
  pitchesToNotes,
  targetPitches,
  togglePitch,
  voicingFor,
  voicingPitches,
} from "./keyboard-fretboard-notes";

const cMinor = { kind: "chord", quality: "minor", root: "C" } as const;
const cMajor = { kind: "chord", quality: "major", root: "C" } as const;

describe("keyboard notes", () => {
  it("reads chord and note targets as pitch classes", () => {
    expect(targetPitches(cMinor)).toStrictEqual([0, 3, 7]);
    expect(targetPitches({ kind: "notes", notes: ["G", "B", "D4"] })).toStrictEqual([2, 7, 11]);
    expect(targetPitches()).toStrictEqual([]);
  });

  it("spells keys the way the target writes them", () => {
    const spell = pitchSpelling([cMinor, cMajor]);

    expect(spell(3)).toBe("Eb");
    expect(spell(4)).toBe("E");
    expect(spell(6)).toBe("F#");
    expect(spell(10)).toBe("Bb");
  });

  it("toggles keys and names the answer for grading", () => {
    expect(togglePitch([0, 4, 7], 4)).toStrictEqual([0, 7]);
    expect(togglePitch([0, 7], 3)).toStrictEqual([0, 3, 7]);
    expect(pitchesToNotes([0, 3, 7])).toStrictEqual(["C4", "D#4", "G4"]);
  });

  it("marks kept, new and removed notes, then right, wrong and missing ones", () => {
    expect(answeringMarks({ pressed: [0, 3, 7], start: [0, 4, 7] })).toStrictEqual(
      new Map([
        [64, "removed"],
        [60, "kept"],
        [63, "new"],
        [67, "kept"],
      ]),
    );

    expect(checkedMarks({ expected: [0, 3, 7], pressed: [0, 2, 7] })).toStrictEqual(
      new Map([
        [63, "missed"],
        [60, "correct"],
        [62, "wrong"],
        [67, "correct"],
      ]),
    );
  });
});

describe("guitar shapes for the keys", () => {
  it("voices a chord from its root and reads the shape back", () => {
    const shape = voicingFor([0, 3, 7]);

    expect(shape).toStrictEqual([null, 3, 1, 0, 1, 3]);
    expect(voicingPitches(shape ?? [])).toStrictEqual([0, 3, 7]);
    expect(voicingFor([])).toBeNull();
  });

  it("starts the window at the nut unless the shape sits higher", () => {
    expect(fretWindowStart([null, 3, 1, 0, 1, 3], 4)).toBe(1);
    expect(fretWindowStart([null, 7, 9, 9, 8, 7], 4)).toBe(7);
    expect(fretWindowStart(null, 4)).toBe(1);
  });
});
