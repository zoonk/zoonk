import { describe, expect, it } from "vitest";
import { BUDDY_ACTS } from "../_buddy/buddy-acts";
import { TRICKSTER_ACTS } from "../_trickster/trickster-acts";
import { type Act } from "./acting";
import {
  type EaseResolver,
  buildPropertyKeyframes,
  buildSwapKeyframes,
  getTrackProperties,
} from "./keyframes";

const ease: EaseResolver = (name) => name;

describe(buildPropertyKeyframes, () => {
  it("starts where the part is drawn and lands on the expression's pose, so an act never jumps", () => {
    const keyframes = buildPropertyKeyframes({
      ease,
      frames: 10,
      from: { rotate: -7 },
      property: "rotate",
      to: { rotate: -18 },
      track: { keys: [{ at: 4, ease: "out", rotate: -14 }], part: "crown", settle: "follow" },
    });

    expect(keyframes).toStrictEqual([
      { easing: "out", offset: 0, rotate: "-7deg" },
      { easing: "follow", offset: 0.4, rotate: "-14deg" },
      { easing: "out", offset: 1, rotate: "-18deg" },
    ]);
  });

  it("starts and lands at rest when no expression poses the part", () => {
    const keyframes = buildPropertyKeyframes({
      ease,
      frames: 6,
      from: { opacity: 0 },
      property: "opacity",
      to: { opacity: 0 },
      track: {
        keys: [
          { at: 1.5, ease: "hold", opacity: 1 },
          { at: 3.5, ease: "hold", opacity: 0 },
        ],
        part: "lid-left",
      },
    });

    expect(keyframes.map((keyframe) => [keyframe.offset, keyframe.opacity])).toStrictEqual([
      [0, 0],
      [0.25, 1],
      [3.5 / 6, 0],
      [1, 0],
    ]);

    expect(keyframes[0]?.easing).toBe("hold");
  });

  it("lets a key at the first or the last frame replace that end", () => {
    const keyframes = buildPropertyKeyframes({
      ease,
      frames: 8,
      from: {},
      property: "translate",
      to: {},
      track: {
        keys: [
          { at: 0, translate: [0, -4] },
          { at: 8, ease: "swing", translate: [0, 2] },
        ],
        part: "sweat",
      },
    });

    expect(keyframes).toStrictEqual([
      { easing: "swing", offset: 0, translate: "0px -4px" },
      { easing: "out", offset: 1, translate: "0px 2px" },
    ]);
  });

  it("writes a stretch as one number or two, the way CSS reads it", () => {
    const keyframes = buildPropertyKeyframes({
      ease,
      frames: 4,
      from: {},
      property: "scale",
      to: {},
      track: { keys: [{ at: 2, scale: [1.06, 0.88] }], part: "body" },
    });

    expect(keyframes.map((keyframe) => keyframe.scale)).toStrictEqual(["1", "1.06 0.88", "1"]);
  });
});

describe(getTrackProperties, () => {
  it("lists only the properties the track's keys move", () => {
    expect(
      getTrackProperties({
        keys: [
          { at: 2, rotate: 3 },
          { at: 4, scale: [1, 0.9], translate: [0, 1] },
        ],
        part: "head",
      }),
    ).toStrictEqual(["rotate", "scale", "translate"]);
  });

  it("adds what the part's pose changes in between start and landing, so it eases there", () => {
    const crown = { keys: [], part: "crown" } as const;

    expect(getTrackProperties(crown, { rotate: -7 }, {})).toStrictEqual(["rotate"]);
    expect(getTrackProperties(crown, { rotate: -7 }, { rotate: -7 })).toStrictEqual([]);
    expect(getTrackProperties(crown, {}, { rotate: 0, scale: 1 })).toStrictEqual([]);
  });
});

describe(buildSwapKeyframes, () => {
  it("shows the old face until the swap frame and the new one from it", () => {
    expect(buildSwapKeyframes({ frames: 10, showing: "before", swapAt: 4 })).toStrictEqual([
      { offset: 0, opacity: 1 },
      { offset: 0.4, opacity: 1 },
      { offset: 0.4, opacity: 0 },
      { offset: 1, opacity: 0 },
    ]);

    expect(buildSwapKeyframes({ frames: 10, showing: "after", swapAt: 4 })).toStrictEqual([
      { offset: 0, opacity: 0 },
      { offset: 0.4, opacity: 0 },
      { offset: 0.4, opacity: 1 },
      { offset: 1, opacity: 1 },
    ]);
  });
});

function describeAct(act: Act<string>) {
  return act.tracks.flatMap((track) =>
    getTrackProperties(track).map((property) => ({
      ats: track.keys.filter((key) => key[property] !== undefined).map((key) => key.at),
      label: `${track.part} ${property}`,
    })),
  );
}

describe("every act", () => {
  const acts = Object.entries({ ...BUDDY_ACTS, ...TRICKSTER_ACTS }) as [string, Act<string>][];

  it.each(acts)("%s keeps its keys in order, inside its frames", (_name, act) => {
    for (const { ats } of describeAct(act)) {
      expect(ats).toStrictEqual(ats.toSorted((first, second) => first - second));
      expect(Math.min(...ats)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ats)).toBeLessThanOrEqual(act.frames);
    }
  });

  const swapping = acts.filter(([, act]) => act.swapAt !== undefined);

  it.each(swapping)("%s swaps the face into the expression it lands in", (_name, act) => {
    expect(act.to).toBeDefined();
    expect(act.swapAt).toBeGreaterThan(0);
    expect(act.swapAt).toBeLessThan(act.frames);
  });
});
