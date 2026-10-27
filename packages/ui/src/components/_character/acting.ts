import { readDuration, readEasing } from "@zoonk/ui/lib/motion";
import {
  type ActTrack,
  type EaseResolver,
  buildPropertyKeyframes,
  buildSwapKeyframes,
  getTrackProperties,
} from "./keyframes";
import { type PartPose } from "./part";

/**
 * A short performance on a character's parts, timed in frames at 24 a second: what moves, when, and
 * the expression it lands in. At `swapAt` the face is replaced by the landing expression's, the way
 * a 2D animator swaps a mouth or a pair of eyes, usually while the eyes are shut or a part is
 * squashed, so the change reads as one motion.
 */
export type Act<Expression extends string> = {
  frames: number;
  swapAt?: number;
  to?: Expression;
  tracks: readonly ActTrack[];
};

/** Each expression's part poses, by `data-part`. */
export type PosesByExpression<Expression extends string> = Partial<
  Record<Expression, Partial<Record<string, PartPose>>>
>;

/** An act under way: its animations, and a promise that settles once it landed or stopped. */
export type ActPlayback = { animations: Animation[]; finished: Promise<unknown> };

/**
 * The token's curve, or the ease-out where the browser can't run it: `element.animate()` throws on
 * a curve it doesn't know (`linear()` before Safari 17.2), where a stylesheet would just skip it.
 */
function resolveEase(root: Element): EaseResolver {
  return (ease) => {
    if (ease === "hold") {
      return "steps(1, jump-end)";
    }

    const curve = readEasing(root, ease);
    return CSS.supports("animation-timing-function", curve) ? curve : "ease-out";
  };
}

/**
 * Plays an act on a character drawn in `root`, from the expression it shows (`from`), on the
 * browser's animation clock: every part moves on its own (`rotate`, `scale`, `translate`,
 * `opacity`), held at its last frame until the caller draws the landing expression and cancels
 * them. `delay` holds the drawing still for that many milliseconds first, on the same clock, so a
 * slowed page slows the wait too. With reduced motion (the frame token is 0) nothing moves and
 * nothing waits: the caller draws the landing expression at once.
 */
export function playAct<Expression extends string>({
  act,
  delay = 0,
  from,
  playbackRate = 1,
  poses = {},
  root,
}: {
  act: Act<Expression>;
  delay?: number;
  from: Expression;
  playbackRate?: number;
  poses?: PosesByExpression<Expression>;
  root: Element;
}): ActPlayback {
  const frameMs = readDuration(root, "frame");

  if (frameMs === 0) {
    return { animations: [], finished: Promise.resolve() };
  }

  const duration = act.frames * frameMs;
  const ease = resolveEase(root);
  const options: KeyframeAnimationOptions = { delay, duration, fill: "forwards" };
  const to = act.to ?? from;

  const partAnimations = act.tracks.flatMap((track) => {
    const fromPose = { ...track.rest, ...poses[from]?.[track.part] };
    const toPose = { ...track.rest, ...poses[to]?.[track.part] };
    const elements = [...root.querySelectorAll(`[data-part="${track.part}"]`)];

    return getTrackProperties(track, fromPose, toPose).flatMap((property) => {
      const keyframes = buildPropertyKeyframes({
        ease,
        frames: act.frames,
        from: fromPose,
        property,
        to: toPose,
        track,
      });

      return elements.map((element) => element.animate(keyframes, options));
    });
  });

  const swapAnimations =
    act.swapAt === undefined || to === from
      ? []
      : (["before", "after"] as const).flatMap((showing) => {
          const face = showing === "before" ? from : to;

          const keyframes = buildSwapKeyframes({
            frames: act.frames,
            showing,
            swapAt: act.swapAt ?? 0,
          });

          return [...root.querySelectorAll(`[data-face="${face}"]`)].map((element) =>
            element.animate(keyframes, options),
          );
        });

  const animations = [...partAnimations, ...swapAnimations];

  for (const animation of animations) {
    animation.playbackRate = playbackRate;
  }

  return {
    animations,
    finished: Promise.allSettled(animations.map((animation) => animation.finished)),
  };
}
