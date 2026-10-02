import { describe, expect, it } from "vitest";
import { findGuitarVoicing } from "./guitar-voicing";

/** Pitch classes: C 0, D 2, E 4, F 5, G 7, A 9, B 11, with Eb 3 and Bb 10. */
function voicing(pitchClasses: number[], bass = pitchClasses[0] ?? 0) {
  return findGuitarVoicing({ bass, pitchClasses });
}

describe(findGuitarVoicing, () => {
  it("finds the open shapes guitarists learn first", () => {
    expect(voicing([0, 4, 7])).toStrictEqual([null, 3, 2, 0, 1, 0]);
    expect(voicing([7, 11, 2])).toStrictEqual([3, 2, 0, 0, 0, 3]);
    expect(voicing([2, 6, 9])).toStrictEqual([null, null, 0, 2, 3, 2]);
    expect(voicing([9, 0, 4])).toStrictEqual([null, 0, 2, 2, 1, 0]);
    expect(voicing([4, 7, 11])).toStrictEqual([0, 2, 2, 0, 0, 0]);
  });

  it("uses a barre when the shape needs one", () => {
    expect(voicing([5, 9, 0])).toStrictEqual([1, 3, 3, 2, 1, 1]);
  });

  it("keeps the requested note in the bass", () => {
    expect(voicing([0, 3, 7])).toStrictEqual([null, 3, 1, 0, 1, 3]);
    expect(voicing([0, 4, 7], 7)).toStrictEqual([3, 3, 2, 0, 1, 0]);
  });

  it("gives up when one hand can't play the notes", () => {
    expect(voicing([0, 1, 2, 3, 4, 5, 6])).toBeNull();
    expect(voicing([])).toBeNull();
  });
});
