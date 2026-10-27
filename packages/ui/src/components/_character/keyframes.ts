import { type PartPose } from "./part";

/**
 * How a part moves into a key: on a motion token's curve, or held until the key and then changed
 * at once (`hold`, as an animator swaps a drawing).
 */
type ActEase = "accelerate" | "follow" | "hold" | "out" | "spring" | "swing";

/** A part's pose at one frame of an act, and the curve it arrives there on. */
export type ActKey = PartPose & { at: number; ease?: ActEase };

/**
 * One part's motion through an act. It starts from the pose the part is drawn in and ends at the
 * pose of the expression the act lands in, on `settle`'s curve, so an act never jumps at either end;
 * a key at frame 0 or at the last frame replaces that end. `rest` is the part's pose when no
 * expression poses it (a blink's lid line rests hidden).
 */
export type ActTrack = { keys: readonly ActKey[]; part: string; rest?: PartPose; settle?: ActEase };

type PoseProperty = keyof PartPose;

const PROPERTIES: readonly PoseProperty[] = ["opacity", "rotate", "scale", "translate"];

/** A pose value as CSS writes it, for `element.animate()`; a part at rest where unposed. */
function formatValue(property: PoseProperty, pose: PartPose): string | number {
  switch (property) {
    case "opacity":
      return pose.opacity ?? 1;
    case "rotate":
      return `${pose.rotate ?? 0}deg`;
    case "scale": {
      const scale = pose.scale ?? 1;
      return typeof scale === "number" ? String(scale) : `${scale[0]} ${scale[1]}`;
    }
    case "translate": {
      const [x, y] = pose.translate ?? [0, 0];
      return `${x}px ${y}px`;
    }
    default:
      return 0;
  }
}

/** A curve as `element.animate()` takes it: a token from the stylesheet, or a held step. */
export type EaseResolver = (ease: ActEase) => string;

/**
 * One property's keyframes for a track: the part's start pose, the act's keys, its landing pose.
 * Each keyframe carries the curve that reaches the next one, as `element.animate()` reads it.
 */
export function buildPropertyKeyframes({
  ease,
  frames,
  from,
  property,
  to,
  track,
}: {
  ease: EaseResolver;
  frames: number;
  from: PartPose;
  property: PoseProperty;
  to: PartPose;
  track: ActTrack;
}): Keyframe[] {
  const keys = track.keys.filter((key) => key[property] !== undefined);
  const first = keys[0];
  const last = keys.at(-1);
  const start: ActKey[] = first?.at === 0 ? [] : [{ ...from, at: 0 }];
  const end: ActKey[] = last?.at === frames ? [] : [{ ...to, at: frames, ease: track.settle }];
  const all = [...start, ...keys, ...end];

  return all.map((key, index) => ({
    easing: ease(all[index + 1]?.ease ?? "out"),
    offset: Math.min(1, Math.max(0, key.at / frames)),
    [property]: formatValue(property, key),
  }));
}

/** The properties a track moves. */
export function getTrackProperties(track: ActTrack): PoseProperty[] {
  return PROPERTIES.filter((property) => track.keys.some((key) => key[property] !== undefined));
}

/** A face swap: the old face shown until the swap frame, the new one from it. */
export function buildSwapKeyframes({
  frames,
  showing,
  swapAt,
}: {
  frames: number;
  showing: "before" | "after";
  swapAt: number;
}): Keyframe[] {
  const offset = swapAt / frames;
  const [before, after] = showing === "before" ? [1, 0] : [0, 1];

  return [
    { offset: 0, opacity: before },
    { offset, opacity: before },
    { offset, opacity: after },
    { offset: 1, opacity: after },
  ];
}
