import { describe, expect, it } from "vitest";
import {
  chordMidis,
  chordSymbol,
  displayNoteName,
  midiToNote,
  nameChord,
  noteToMidi,
  spellChord,
  spellInterval,
} from "./music-notes";

describe("note numbers", () => {
  it("converts between names and MIDI numbers around middle C", () => {
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("Eb")).toBe(63);
    expect(noteToMidi("F#3")).toBe(54);
    expect(noteToMidi("Cb4")).toBe(59);
    expect(noteToMidi("H")).toBeNull();
    expect(midiToNote(61)).toBe("C#4");
    expect(midiToNote(48)).toBe("C3");
  });

  it("voices chords upward from the root", () => {
    expect(chordMidis("C", "minor")).toStrictEqual([60, 63, 67]);
    expect(chordMidis("G3", "dominant7")).toStrictEqual([55, 59, 62, 65]);
  });
});

describe("spelling", () => {
  it("spells chord tones from the root's letter", () => {
    expect(spellChord("C", "minor")).toStrictEqual(["C", "Eb", "G"]);
    expect(spellChord("F#", "major")).toStrictEqual(["F#", "A#", "C#"]);
    expect(spellChord("Bb", "dominant7")).toStrictEqual(["Bb", "D", "F", "Ab"]);
    expect(spellChord("C", "augmented")).toStrictEqual(["C", "E", "G#"]);
    expect(spellChord("B", "diminished")).toStrictEqual(["B", "D", "F"]);
  });

  it("spells the top of an interval", () => {
    expect(spellInterval("C4", "P5")).toBe("G");
    expect(spellInterval("C4", "m3")).toBe("Eb");
    expect(spellInterval("E", "P8")).toBe("E");
    expect(spellInterval("C", "TT")).toBe("F#");
  });

  it("names the chord a set of pitch classes forms", () => {
    expect(nameChord([0, 3, 7])).toStrictEqual({ quality: "minor", root: "C" });
    expect(nameChord([7, 11, 2, 5])).toStrictEqual({ quality: "dominant7", root: "G" });
    expect(nameChord([0, 2, 4])).toBeNull();
    expect(chordSymbol("C4", "minor7")).toBe("Cm7");
  });

  it("shows notes with real accidentals and German B and H", () => {
    expect(displayNoteName("Eb", "en")).toBe("E♭");
    expect(displayNoteName("F#4", "pt")).toBe("F♯4");
    expect(displayNoteName("B", "de")).toBe("H");
    expect(displayNoteName("Bb", "de")).toBe("B");
    expect(displayNoteName("Bb", "en")).toBe("B♭");
  });
});
