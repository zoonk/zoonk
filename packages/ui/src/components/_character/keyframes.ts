import { type PartPose } from "./part";

/** `hold` stays put until the key, then changes at once. */
type ActEase = "accelerate" | "follow" | "hold" | "out" | "spring" | "swing";

export type ActKey = PartPose & { at: number; ease?: ActEase };

/**
 * Starts from the part's drawn pose and ends at the landing expression's on `settle`'s curve; a key
 * at frame 0 or the last frame replaces that end.
 */
export type ActTrack = { keys: readonly ActKey[]; part: string; rest?: PartPose; settle?: ActEase };

type PoseProperty = keyof PartPose;

const PROPERTIES: readonly PoseProperty[] = ["opacity", "rotate", "scale", "translate"];

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

export type EaseResolver = (ease: ActEase) => string;

/** Each keyframe carries the curve that reaches the next one, as `element.animate()` reads it. */
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

export function getTrackProperties(
  track: ActTrack,
  from: PartPose = {},
  to: PartPose = {},
): PoseProperty[] {
  return PROPERTIES.filter(
    (property) =>
      track.keys.some((key) => key[property] !== undefined) ||
      formatValue(property, from) !== formatValue(property, to),
  );
}

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
