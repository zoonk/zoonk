import { describe, expect, it } from "vitest";
import {
  earOptions,
  earTrainerSound,
  keyboardRange,
  optionSound,
  playedMidis,
} from "./ear-trainer-sounds";

describe("ear trainer sounds", () => {
  it("plays a wrong pick from the same root to compare", () => {
    const fields = { mode: "interval" as const, options: [], played: "P5" as const, root: "A3" };
    const compare = optionSound(fields, { id: "m3", interval: "m3", kind: "interval", song: null });

    expect(compare.map((event) => event.midi)).toStrictEqual([57, 60]);
  });

  it("strums chords the way a guitar voices them", () => {
    const gMajor = {
      chord: { quality: "major" as const, root: "G" },
      id: "g",
      kind: "chord" as const,
      song: null,
    };

    const fields = { chords: [gMajor.chord], hidden: 0, mode: "progression" as const, options: [] };

    expect(optionSound(fields, gMajor).map((event) => event.midi)).toStrictEqual([
      43, 47, 50, 55, 59, 67,
    ]);
  });

  it("shows a keyboard from a C or F to an E or B around the notes", () => {
    expect(keyboardRange([60, 67])).toStrictEqual({ from: 60, to: 71 });
    expect(keyboardRange([67, 71, 74])).toStrictEqual({ from: 65, to: 76 });
    expect(keyboardRange([60, 72])).toStrictEqual({ from: 60, to: 76 });
  });
});

describe("ear trainer choices and sounds", () => {
  const major = "major" as const;

  const progression = {
    chords: [
      { quality: major, root: "G" },
      { quality: major, root: "C" },
      { quality: major, root: "D" },
    ],
    hidden: 1,
    mode: "progression" as const,
    options: [
      { id: "g", quality: major, root: "G" },
      { id: "c", quality: major, root: "C" },
    ],
  };

  it("plays an interval low then high and a chord before its notes", () => {
    expect(
      earTrainerSound({ mode: "interval", options: [], played: "P5", root: "C4" }),
    ).toStrictEqual([
      { at: 0, midi: 60 },
      { at: 0.9, midi: 67 },
    ]);

    const chord = earTrainerSound({ mode: "chord", options: [], played: "minor", root: "A3" });
    expect(chord.slice(0, 3).map((event) => event.at)).toStrictEqual([0, 0, 0]);
    expect(chord.slice(3).map((event) => event.midi)).toStrictEqual([57, 60, 64]);
  });

  it("strums a progression chord by chord and marks the hidden one", () => {
    const sound = earTrainerSound(progression);
    const starts = [...new Set(sound.map((event) => Math.floor(event.at)))];

    expect(starts).toStrictEqual([0, 1, 3]);
    expect(playedMidis(progression)).toStrictEqual([60, 64, 67]);

    expect(earOptions(progression)[1]).toStrictEqual({
      chord: { quality: "major", root: "C" },
      id: "c",
      kind: "chord",
      song: null,
    });
  });
});
